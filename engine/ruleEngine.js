import { CONFIG, RULES } from "./library.js";

export class RuleEngine {
  constructor(models, mikrotik, poller = null) {
    this.models = models;
    this.mikrotik = mikrotik;
    this.poller = poller;
    this.cache = new Map();
    this.initialUp = new Map();
    this.previousInterfaceStatus = new Map();
    this.correlationEngine = null;
    this.eventLocks = new Set();
  }

  setPoller(poller) {
    this.poller = poller;
  }

  setCorrelationEngine(ce) {
    this.correlationEngine = ce;
  }

  setInitialUp(routerIp, ifaces) {
    const up = new Set(ifaces.filter(i => i.running && !i.disabled).map(i => i.name).filter(Boolean));
    this.initialUp.set(routerIp, up);
  }

  async onCpuData(routerName, routerIp, stats, timestamp) {
    const type = RULES.R4.type;
    const key = `${routerIp}:${type}`;
    let event = this.cache.get(key) || await this.models.Event.findOne({
      where: { routerIp, type, status: ['active', 'cooldown'] },
      order: [['startedAt', 'DESC']]
    });
    if (event) this.cache.set(key, event);
    const now = new Date(timestamp);

    const active = stats.count >= CONFIG.windowsLength && stats.avg >= RULES.R4.threshold;

    if (active) {
      if (!event || event.status === 'ended') {
        const topTasks = await this.mikrotik.topCpuTasks();
        const evidence = {
          cpu_at_trigger: stats.current,
          cpu_avg_prev_60s: stats.avg,
          top_tasks_at_trigger: topTasks
        };
        event = await this.models.Event.create({
          routerName, routerIp,
          ruleId: RULES.R4.id,
          type,
          status: 'active',
          evidence,
          startedAt: now,
          lastSeenAt: now,
        });
        this.cache.set(key, event);
        if (this.correlationEngine) await this.correlationEngine.evaluateRouter(routerIp);
      } else {
        const updates = { lastSeenAt: now };
        if (event.status === 'cooldown') {
          updates.status = 'active';
          updates.cooldownUntil = null;
        }
        if (Object.keys(updates).length > 0) {
          await event.update(updates);
          this.cache.set(key, event);
        }
      }
    } else {
      if (event && (event.status === 'active' || event.status === 'cooldown')) {
        if (event.status === 'active') {
          await event.update({
            status: 'cooldown',
            cooldownUntil: new Date(now.getTime() + CONFIG.eventCooldownMs),
            lastSeenAt: now
          });
        } else if (event.status === 'cooldown' && event.cooldownUntil && now >= event.cooldownUntil) {
          await event.update({ status: 'ended', endedAt: now });
          this.cache.delete(key);
        }
      }
    }
  }

  async onDelayData(routerName, routerIp, stats, timestamp) {
    const type = RULES.R2.type;
    const key = `${routerIp}:${type}`;
    let event = this.cache.get(key) || await this.models.Event.findOne({
      where: { routerIp, type, status: ['active', 'cooldown'] },
      order: [['startedAt', 'DESC']]
    });
    if (event) this.cache.set(key, event);
    const now = new Date(timestamp);

    const active = stats.count >= CONFIG.windowsLength && stats.avg >= RULES.R2.threshold;

    if (active) {
      if (!event || event.status === 'ended') {
        const evidence = {
          delay_prev_60s: { avg: stats.avg, min: stats.min, max: stats.max }
        };
        event = await this.models.Event.create({
          routerName, routerIp,
          ruleId: RULES.R2.id,
          type,
          status: 'active',
          evidence,
          startedAt: now,
          lastSeenAt: now,
        });
        this.cache.set(key, event);
        if (this.correlationEngine) await this.correlationEngine.evaluateRouter(routerIp);
      } else {
        const updates = { lastSeenAt: now };
        if (event.status === 'cooldown') {
          updates.status = 'active';
          updates.cooldownUntil = null;
        }
        if (Object.keys(updates).length > 0) {
          await event.update(updates);
          this.cache.set(key, event);
        }
      }
    } else {
      if (event && (event.status === 'active' || event.status === 'cooldown')) {
        if (event.status === 'active') {
          await event.update({
            status: 'cooldown',
            cooldownUntil: new Date(now.getTime() + CONFIG.eventCooldownMs),
            lastSeenAt: now
          });
        } else if (event.status === 'cooldown' && event.cooldownUntil && now >= event.cooldownUntil) {
          await event.update({ status: 'ended', endedAt: now });
          this.cache.delete(key);
        }
      }
    }
  }

  async onPacketLossData(routerName, routerIp, plStats, timestamp) {
    const type = RULES.R3.type;
    const key = `${routerIp}:${type}`;
    let event = this.cache.get(key) || await this.models.Event.findOne({
      where: { routerIp, type, status: ['active', 'cooldown'] },
      order: [['startedAt', 'DESC']]
    });
    if (event) this.cache.set(key, event);
    const now = new Date(timestamp);

    const active = plStats.count >= CONFIG.windowsLength && plStats.lossPct >= RULES.R3.threshold;

    if (active) {
      if (!event || event.status === 'ended') {
        const evidence = {
          packet_loss_prev_60s: {
            total_loss: plStats.totalLoss,
            total_sent: plStats.totalSent,
            total_received: plStats.totalReceived,
            loss_percentage: plStats.lossPct,
          }
        };
        event = await this.models.Event.create({
          routerName, routerIp,
          ruleId: RULES.R3.id,
          type,
          status: 'active',
          evidence,
          startedAt: now,
          lastSeenAt: now,
        });
        this.cache.set(key, event);
        if (this.correlationEngine) await this.correlationEngine.evaluateRouter(routerIp);
      } else {
        const updates = { lastSeenAt: now };
        if (event.status === 'cooldown') {
          updates.status = 'active';
          updates.cooldownUntil = null;
        }
        if (Object.keys(updates).length > 0) {
          await event.update(updates);
          this.cache.set(key, event);
        }
      }
    } else {
      if (event && (event.status === 'active' || event.status === 'cooldown')) {
        if (event.status === 'active') {
          await event.update({
            status: 'cooldown',
            cooldownUntil: new Date(now.getTime() + CONFIG.eventCooldownMs),
            lastSeenAt: now
          });
        } else if (event.status === 'cooldown' && event.cooldownUntil && now >= event.cooldownUntil) {
          await event.update({ status: 'ended', endedAt: now });
          this.cache.delete(key);
        }
      }
    }
  }

  async onInterfaceData(routerName, routerIp, interfaces) {
    const type = RULES.R1.type;
    const now = new Date();

    const key = `prevStatus:${routerIp}`;
    let previousStatus = this.previousInterfaceStatus.get(key);

    const currentStatus = new Map();
    for (const iface of interfaces) {
      const isUp = iface.status === 'up';
      currentStatus.set(iface.name, { isUp, disabled: iface.disabled, id: iface.id, type: iface.type });
    }

    if (previousStatus) {
      for (const [ifaceName, currentState] of currentStatus) {
        const prevState = previousStatus.get(ifaceName);

        if (prevState && prevState.isUp && !currentState.isUp) {
          const lockKey = `interface:${routerIp}:${ifaceName}`;
          if (this.eventLocks.has(lockKey)) continue;
          this.eventLocks.add(lockKey);

          try {
            const allActive = await this.models.Event.findAll({
              where: { routerIp, type, status: 'active' }
            });
            let existingEvent = allActive.find(ev => ev.evidence?.interfaces?.[0]?.name === ifaceName);

            if (!existingEvent) {
              const reason = currentState.disabled ? 'interface dimatikan' : 'interface terputus';

              await this.models.Event.create({
                routerName, routerIp,
                ruleId: RULES.R1.id,
                type,
                status: 'active',
                evidence: {
                  interfaces: [{
                    id: currentState.id,
                    name: ifaceName,
                    type: currentState.type,
                    reason: reason
                  }]
                },
                startedAt: now,
                lastSeenAt: now,
              });
              if (this.correlationEngine) await this.correlationEngine.evaluateRouter(routerIp);
            } else {
              await existingEvent.update({ lastSeenAt: now });
            }
          } finally {
            this.eventLocks.delete(lockKey);
          }
        }
      }
    }

    const allActiveEvents = await this.models.Event.findAll({
      where: { routerIp, type, status: 'active' }
    });

    for (const event of allActiveEvents) {
      const ifaceName = event.evidence?.interfaces?.[0]?.name;
      if (ifaceName) {
        const currentState = currentStatus.get(ifaceName);
        if (currentState && currentState.isUp) {
          await event.update({ status: 'ended', endedAt: now });
        }
      }
    }

    this.previousInterfaceStatus.set(key, currentStatus);
  }
}