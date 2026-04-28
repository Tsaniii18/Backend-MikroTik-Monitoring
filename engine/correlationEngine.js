import { Op } from "sequelize";
import { CORR, LIB, SUGGESTION, RULES } from "./library.js";

const corrKey = (routerIp, correlationId) => `${routerIp}:${correlationId}`;

export class CorrelationEngine {
  constructor(models) {
    this.models = models;
    this.cache = new Map();
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.evaluateAll().catch(() => {});
    }, 1000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async evaluateAll() {
    const routers = await this.models.Event.findAll({
      attributes: ["routerIp"],
      group: ["routerIp"]
    });

    for (const r of routers) {
      await this.evaluateRouter(r.routerIp);
    }
  }

  async evaluateRouter(routerIp) {
    const windowMs = LIB.correlationWindowMs;

    const events = await this.models.Event.findAll({
      where: {
        routerIp,
        status: { [Op.in]: ["active", "cooldown"] }
      },
      order: [["startedAt", "ASC"]]
    });

    const r2 = events.filter(e => e.type === RULES.R2.type);
    const r3 = events.filter(e => e.type === RULES.R3.type);
    const r4 = events.filter(e => e.type === RULES.R4.type);

    for (const ev2 of r2) {
      const t2 = new Date(ev2.startedAt).getTime();

      for (const ev3 of r3) {
        const t3 = new Date(ev3.startedAt).getTime();

        if (Math.abs(t2 - t3) > windowMs) continue;

        const baseTime = Math.max(t2, t3);
        const windowEnd = baseTime + windowMs;

        const matchingR4 = r4.find(ev4 => {
          const t4 = new Date(ev4.startedAt).getTime();
          return t4 >= baseTime && t4 <= windowEnd;
        });

        if (matchingR4) {
          await this.deleteActive(routerIp, CORR.C1.id);
          await this.createOrUpdateIndication({
            routerIp,
            correlationId: CORR.C2.id,
            indication: CORR.C2.description,
            recommended_action: SUGGESTION.C2,
            events: [ev2, ev3, matchingR4]
          });
        } else {
          const hasC2 = await this.findActive(routerIp, CORR.C2.id);
          if (!hasC2) {
            await this.createOrUpdateIndication({
              routerIp,
              correlationId: CORR.C1.id,
              indication: CORR.C1.description,
              recommended_action: SUGGESTION.C1,
              events: [ev2, ev3]
            });
          }
        }
      }
    }

    const { Indication } = this.models;

    const actives = await Indication.findAll({
      where: {
        status: "active",
        [Op.and]: Indication.sequelize.where(
          Indication.sequelize.json("source_device.ip"),
          routerIp
        )
      }
    });

    for (const ind of actives) {
      const evs = await ind.getEvents();
      const allEnded = evs.length && evs.every(e => e.status === "ended");
      if (allEnded) {
        await ind.update({
          status: "ended",
          endedAt: new Date()
        });
        this.cache.delete(corrKey(routerIp, ind.correlationId));
      }
    }
  }

  async findActive(routerIp, correlationId) {
    const { Indication } = this.models;
    return Indication.findOne({
      where: {
        correlationId,
        status: "active",
        [Op.and]: Indication.sequelize.where(
          Indication.sequelize.json("source_device.ip"),
          routerIp
        )
      }
    });
  }

  async deleteActive(routerIp, correlationId) {
    const { Indication } = this.models;
    const ind = await Indication.findOne({
      where: {
        correlationId,
        status: "active",
        [Op.and]: Indication.sequelize.where(
          Indication.sequelize.json("source_device.ip"),
          routerIp
        )
      }
    });
    if (ind) {
      await ind.destroy();
      this.cache.delete(corrKey(routerIp, correlationId));
    }
  }

  async createOrUpdateIndication({
    routerIp,
    correlationId,
    indication,
    recommended_action,
    events
  }) {
    const { Indication, IndicationComponent } = this.models;
    const now = new Date();

    let ind = await Indication.findOne({
      where: {
        correlationId,
        status: "active",
        [Op.and]: Indication.sequelize.where(
          Indication.sequelize.json("source_device.ip"),
          routerIp
        )
      }
    });

    const source_device = { ip: routerIp };

    if (!ind) {
      ind = await Indication.create({
        source_device,
        correlationId,
        indication,
        recommended_action,
        status: "active",
        startedAt: now
      });

      for (const ev of events) {
        await IndicationComponent.create({
          indicationId: ind.id,
          eventId: ev.id
        });
      }

      return;
    }

    const existing = await ind.getEvents();
    const existingIds = new Set(existing.map(e => e.id));

    for (const ev of events) {
      if (!existingIds.has(ev.id)) {
        await IndicationComponent.create({
          indicationId: ind.id,
          eventId: ev.id
        });
      }
    }
  }
}