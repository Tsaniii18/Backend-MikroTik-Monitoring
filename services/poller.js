import { Op } from "sequelize";
import { CONFIG } from "../engine/library.js";
import {
  pushWindow,
  safeJson,
  parseTimeMs,
  parsePercent,
  parseMiB,
  windowStats,
  windowStatsPacketLoss,
} from "../utils/utils.js";

export class Poller {
  constructor({ mikrotik, ruleEngine, correlationEngine, models, io, state }) {
    this.mikrotik = mikrotik;
    this.ruleEngine = ruleEngine;
    this.correlationEngine = correlationEngine;
    this.models = models;
    this.io = io;
    this.state = state;
    this.isRunning = false;
    this.windows = {
      cpu: [],
      memory: [],
      delay: [],
      packetLoss: [],
    };
    this.ifacePrev = new Map();
  }

  async stop() {
    this.isRunning = false;
    // Wait for current loop iteration to finish gracefully
    if (this.loopPromise) {
      await this.loopPromise;
      this.loopPromise = null;
    }
    this.windows = { cpu: [], memory: [], delay: [], packetLoss: [] };
    this.ifacePrev.clear();
  }

  start() {
    this.stop().then(() => {
      this.isRunning = true;
      this.loopPromise = this.runLoop();
    });
  }

  async runLoop() {
    while (this.isRunning) {
      const start = Date.now();
      
      // Run all polling tasks sequentially
      await this.pollResource();
      await this.pollPing();
      await this.pollInterfaces();
      
      const elapsed = Date.now() - start;
      const delay = Math.max(0, CONFIG.pollingIntervalMs - elapsed);
      if (delay > 0 && this.isRunning) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  getWindowData(windowName, sinceTimestamp) {
    const window = this.windows[windowName];
    if (!window) return [];
    return window.filter((item) => item.ts >= sinceTimestamp);
  }

  async pollResource() {
    const raw = await this.mikrotik.getResource();
    const cpuLoad = parsePercent(raw?.["cpu-load"]);
    const totalMem = parseMiB(raw?.["total-memory"]);
    const freeMem = parseMiB(raw?.["free-memory"]);
    const usedMem = Math.max(0, totalMem - freeMem);
    const freeMemPct = totalMem ? (freeMem / totalMem) * 100 : 0;
    const usedMemPct = totalMem ? (usedMem / totalMem) * 100 : 0;
    const uptime = raw?.uptime;
    const timestamp = Date.now();

    pushWindow(
      this.windows.cpu,
      { ts: timestamp, loadPct: Number(cpuLoad.toFixed(2)) },
      CONFIG.windowsLength,
    );
    pushWindow(
      this.windows.memory,
      {
        ts: timestamp,
        freeMem: Number(freeMem.toFixed(2)),
        freeMemPct: Number(freeMemPct.toFixed(2)),
        usedMem: Number(usedMem.toFixed(2)),
        usedMemPct: Number(usedMemPct.toFixed(2)),
      },
      CONFIG.windowsLength,
    );
    this.state.dynamic.uptime = uptime;

    const cpuStats = windowStats(this.windows.cpu, "loadPct");
    if (this.ruleEngine) {
      await this.ruleEngine.onCpuData(
        this.state.router.name,
        this.state.router.ip,
        cpuStats,
        timestamp,
      );
    }
    await this.emitSnapshot();
  }

  async pollPing() {
    const target = this.state.pingTarget;
    const raw = await this.mikrotik.ping(target, 10, 450);
    const timestamp = Date.now();
    const sentVals = raw.map(r => Number(r?.sent)).filter(Number.isFinite);
    const receivedVals = raw.map(r => Number(r?.received)).filter(Number.isFinite);
    const packetSent = sentVals.length ? Math.max(...sentVals) : 0;
    const packetReceived = receivedVals.length ? Math.max(...receivedVals) : 0;
    const times = raw.map(r => r?.time).filter(t => t != null);
    const delayMsArray = (times || [])
      .map((t) => parseTimeMs(t))
      .filter((ms) => Number.isFinite(ms) && ms > 0);
    const avgDelayMs = delayMsArray.length
      ? delayMsArray.reduce((a, b) => a + b, 0) / delayMsArray.length
      : 0;

    pushWindow(
      this.windows.delay,
      { ts: timestamp, avgMs: Number(avgDelayMs.toFixed(2)) },
      CONFIG.windowsLength,
    );
    pushWindow(
      this.windows.packetLoss,
      {
        ts: timestamp,
        packetSent,
        packetReceived,
      },
      CONFIG.windowsLength,
    );

    const delayStats = windowStats(this.windows.delay, "avgMs");
    const plStats = windowStatsPacketLoss(this.windows.packetLoss);

    if (this.ruleEngine) {
      await this.ruleEngine.onDelayData(
        this.state.router.name,
        this.state.router.ip,
        delayStats,
        timestamp,
      );
      await this.ruleEngine.onPacketLossData(
        this.state.router.name,
        this.state.router.ip,
        plStats,
        timestamp,
      );
    }
    await this.emitSnapshot();
  }

  async pollInterfaces() {
    try {
      const rawIfaces = await this.mikrotik.getInterfaces();
      const processed = rawIfaces.map((iface) => {
        const name = iface?.name;
        const type = iface?.type;
        const running = iface?.running === true || iface?.running === "true";
        const disabled = iface?.disabled === true || iface?.disabled === "true";
        let status = "down";
        if (disabled) status = "disabled";
        else if (running) status = "up";
        return {
          id: iface?.id,
          name,
          type,
          status,
          disabled,
        };
      });
      this.state.dynamic.interfaces = processed;
      if (!this.state.initialInterfacesSet && this.ruleEngine) {
        this.ruleEngine.setInitialUp(
          this.state.router.ip,
          processed.map((x) => ({
            name: x.name,
            type: x.type,
            running: x.status === "up",
            disabled: x.status === "disabled",
          })),
        );
        this.state.initialInterfacesSet = true;
      }
      if (this.ruleEngine) {
        await this.ruleEngine.onInterfaceData(
          this.state.router.name,
          this.state.router.ip,
          processed,
        );
      }
    } catch (err) {
      console.error("pollInterfaces error:", err);
      if (!this.state.dynamic.interfaces) {
        this.state.dynamic.interfaces = [];
      }
    } finally {
      await this.emitSnapshot();
    }
  }

  async emitSnapshot() {
    try {
      if (!this.state.router?.ip) return;

      const activeEvents = await this.models.Event.findAll({
        where: {
          routerIp: this.state.router.ip,
          status: ["active", "cooldown"],
        },
        order: [["startedAt", "DESC"]],
        limit: 80,
      });

      const indications = await this.models.Indication.findAll({
        where: {
          [Op.and]: this.models.Indication.sequelize.where(
            this.models.Indication.sequelize.json("source_device.ip"),
            this.state.router.ip,
          ),
          status: "active",
        },
        order: [["startedAt", "DESC"]],
        limit: 50,
      });

      const indicationsWithEvents = [];
      for (const ind of indications) {
        const events = await ind.getEvents({ order: [["startedAt", "ASC"]] });
        indicationsWithEvents.push({
          ...ind.toJSON(),
          events: events.map((e) => e.toJSON()),
        });
      }

      const payload = {
        router: safeJson(this.state.router),
        uptime: this.state.dynamic.uptime,
        pingTarget: this.state.pingTarget,
        windows: {
          cpu: {
            data: safeJson(this.windows.cpu),
            stats: windowStats(this.windows.cpu, "loadPct"),
          },
          memory: {
            data: safeJson(this.windows.memory),
            stats: windowStats(this.windows.memory, "usedMemPct"),
          },
          delay: {
            data: safeJson(this.windows.delay),
            stats: windowStats(this.windows.delay, "avgMs"),
          },
          packetLoss: {
            data: safeJson(this.windows.packetLoss),
            stats: windowStatsPacketLoss(this.windows.packetLoss),
          },
        },
        interfaces: safeJson(this.state.dynamic.interfaces || []),
        events: safeJson(activeEvents.map((e) => e.toJSON())),
        indications: indicationsWithEvents,
      };
      this.io.emit("snapshot", payload);
    } catch (err) {
      console.error("Error emitting snapshot:", err);
    }
  }
}