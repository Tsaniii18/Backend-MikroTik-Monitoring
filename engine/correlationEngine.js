import { Op } from 'sequelize';
import { RULES, CORRELATION, CONFIG } from './library.js';

export class CorrelationEngine {
  constructor(models) {
    this.models = models;
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.evaluateAll().catch(() => {});
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async evaluateAll() {
    const routers = await this.models.Event.findAll({
      attributes: ['routerIp'],
      group: ['routerIp']
    });
    for (const r of routers) {
      await this.evaluateRouter(r.routerIp);
    }
  }

  async evaluateRouter(routerIp) {
    const { Event, Indication, IndicationComponent } = this.models;
    const activeEvents = await Event.findAll({
      where: { routerIp, status: 'active' }
    });

    const r2Events = activeEvents.filter(e => e.type === RULES.R2.type);
    const r3Events = activeEvents.filter(e => e.type === RULES.R3.type);
    const r4Events = activeEvents.filter(e => e.type === RULES.R4.type);

    const jsonIpCondition = Indication.sequelize.where(
      Indication.sequelize.json('source_device.ip'),
      routerIp
    );

    const [indicationC1, indicationC2] = await Promise.all([
      Indication.findOne({
        where: {
          correlationId: CORRELATION.C1.id,
          status: 'active',
          [Op.and]: jsonIpCondition
        }
      }),
      Indication.findOne({
        where: {
          correlationId: CORRELATION.C2.id,
          status: 'active',
          [Op.and]: jsonIpCondition
        }
      })
    ]);

    const allC2Events = [...r2Events, ...r3Events, ...r4Events];
    const hasR2 = r2Events.length > 0;
    const hasR3 = r3Events.length > 0;
    const hasR4 = r4Events.length > 0;

    let c2Valid = false;
    if (hasR2 && hasR3 && hasR4) {
      const timestamps = allC2Events.map(e => new Date(e.startedAt).getTime());
      const range = Math.max(...timestamps) - Math.min(...timestamps);
      if (range <= CONFIG.correlationWindowMs) {
        c2Valid = true;
      }
    }

    let c1Valid = false;
    if (hasR2 && hasR3 && !c2Valid) {
      const c1Events = [...r2Events, ...r3Events];
      const timestamps = c1Events.map(e => new Date(e.startedAt).getTime());
      const range = Math.max(...timestamps) - Math.min(...timestamps);
      if (range <= CONFIG.correlationWindowMs) {
        c1Valid = true;
      }
    }

    if (c2Valid) {
      const allEvents = [...r2Events, ...r3Events, ...r4Events];
      if (!indicationC2) {
        const ind = await Indication.create({
          source_device: { ip: routerIp },
          correlationId: CORRELATION.C2.id,
          indication: CORRELATION.C2.description,
          recommended_action: CORRELATION.C2.suggestion,
          status: 'active',
          startedAt: new Date()
        });
        for (const ev of allEvents) {
          await IndicationComponent.create({ indicationId: ind.id, eventId: ev.id });
        }
      } else {
        const existing = await indicationC2.getEvents();
        const existingIds = new Set(existing.map(e => e.id));
        for (const ev of allEvents) {
          if (!existingIds.has(ev.id)) {
            await IndicationComponent.create({ indicationId: indicationC2.id, eventId: ev.id });
          }
        }
      }
      if (indicationC1) {
        await indicationC1.destroy();
      }
    } else if (c1Valid) {
      const allEvents = [...r2Events, ...r3Events];
      if (!indicationC1) {
        const ind = await Indication.create({
          source_device: { ip: routerIp },
          correlationId: CORRELATION.C1.id,
          indication: CORRELATION.C1.description,
          recommended_action: CORRELATION.C1.suggestion,
          status: 'active',
          startedAt: new Date()
        });
        for (const ev of allEvents) {
          await IndicationComponent.create({ indicationId: ind.id, eventId: ev.id });
        }
      } else {
        const existing = await indicationC1.getEvents();
        const existingIds = new Set(existing.map(e => e.id));
        for (const ev of allEvents) {
          if (!existingIds.has(ev.id)) {
            await IndicationComponent.create({ indicationId: indicationC1.id, eventId: ev.id });
          }
        }
      }
      if (indicationC2) {
        await indicationC2.destroy();
      }
    } else {
      if (indicationC1) await indicationC1.destroy();
      if (indicationC2) await indicationC2.destroy();
    }

    const activeIndications = await Indication.findAll({
      where: { status: 'active', [Op.and]: jsonIpCondition }
    });

    for (const ind of activeIndications) {
      const evs = await ind.getEvents();
      if (evs.length && evs.every(e => e.status === 'ended')) {
        await ind.update({ status: 'ended', endedAt: new Date() });
      }
    }
  }
}