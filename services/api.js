import express from "express";
import { Op } from "sequelize";
import { parseMiB } from "../utils/utils.js";

export const buildApiRouter = ({ mikrotik, poller, state, models }) => {
  const router = express.Router();

  router.get("/health", (_, res) => res.json({ ok: true }));

  router.post("/auth/login", async (req, res) => {
    const { host, username, password } = req.body || {};
    if (!host || !username) return res.status(400).json({ ok: false, message: "host dan username wajib" });

    try {
      mikrotik.configure({ host, username, password: password ?? "" });
      const info = await mikrotik.getIdentity();

      state.router = {
        name: info.name ?? "unknown",
        ip: host,
        architecture: info.architecture_name ?? "",
        version: info.version ?? "",
        board: info.board_name ?? "",
        platform: info.platform ?? "",
        cpu: info.cpu ?? "",
        cpu_count: info.cpu_count ?? "",
        total_memory: parseMiB(info.total_memory ?? "")
      };
      state.dynamic.uptime = info.uptime;
      state.initialInterfacesSet = false;
      poller.start();
      state.running = true;
      await poller.emitSnapshot();
      res.json({ ok: true, router: state.router });
    } catch (e) {
      poller.stop();
      state.running = false;
      res.status(401).json({ ok: false, message: "Gagal login atau akses RouterOS API (HTTP)" });
    }
  });

  router.post("/auth/logout", async (_, res) => {
    poller.stop();
    state.running = false;
    state.router = { name: "", ip: "" };
    state.dynamic = { uptime: "", interfaces: [] };
    state.initialInterfacesSet = false;
    res.json({ ok: true });
  });

  router.get("/auth/status", (_, res) => res.json({ ok: true, running: !!state.running, router: state.router }));

  router.get("/router/info", (_, res) => res.json({ ok: true, router: state.router, pingTarget: state.pingTarget }));

  router.get("/history/events", async (req, res) => {
    const routerIp = req.query.routerIp || state.router.ip;
    if (!routerIp) return res.json({ ok: true, data: [] });
    const data = await models.Event.findAll({ where: { routerIp, status: "ended" }, order: [["endedAt", "DESC"]], limit: 200 });
    res.json({ ok: true, data });
  });

  router.get("/history/indications", async (req, res) => {
    const routerIp = req.query.routerIp || state.router.ip;
    if (!routerIp) return res.json({ ok: true, data: [] });
    const inds = await models.Indication.findAll({
      where: {
        [Op.and]: models.Indication.sequelize.where(models.Indication.sequelize.json('source_device.ip'), routerIp),
        status: "ended"
      },
      order: [["endedAt", "DESC"]],
      limit: 200
    });
    const out = [];
    for (const ind of inds) {
      const events = await ind.getEvents({ order: [["startedAt", "ASC"]] });
      out.push({ ...ind.toJSON(), events: events.map((e) => e.toJSON()) });
    }
    res.json({ ok: true, data: out });
  });

  router.get("/realtime/indications", async (_, res) => {
    const routerIp = state.router.ip;
    if (!routerIp) return res.json({ ok: true, data: [] });
    const inds = await models.Indication.findAll({
      where: {
        [Op.and]: models.Indication.sequelize.where(models.Indication.sequelize.json('source_device.ip'), routerIp),
        status: "active"
      },
      order: [["startedAt", "DESC"]],
      limit: 50
    });
    const out = [];
    for (const ind of inds) {
      const events = await ind.getEvents({ order: [["startedAt", "ASC"]] });
      out.push({ ...ind.toJSON(), events: events.map((e) => e.toJSON()) });
    }
    res.json({ ok: true, data: out });
  });

  return router;
};