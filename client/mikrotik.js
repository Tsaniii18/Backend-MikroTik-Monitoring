import axios from "axios";

export class MikroTikClient {
  constructor() {
    this.cfg = null;
    this.http = null;
  }

  configure(cfg) {
    this.cfg = { ...cfg };
    const baseURL = `http://${cfg.host}:8080/rest`;
    this.http = axios.create({
      baseURL,
      timeout: 15000,
      auth: { username: cfg.username, password: cfg.password },
    });
    return true;
  }

  isReady() {
    return !!this.http;
  }

  async getIdentity() {
    const { data: identity } = await this.http.get("/system/identity");
    const { data: resource } = await this.http.get("/system/resource");

    return {
      name: identity?.name, 
      version: resource?.version, 
      platform: resource?.platform, 
      cpu: resource?.cpu, 
      cpu_count: Number(resource?.["cpu-count"]), 
      architecture_name: resource?.["architecture-name"], 
      total_memory: Number(resource?.["total-memory"]), 
      board_name: resource?.["board-name"], 
    };
  }

  async getResource() {
    const { data } = await this.http.get("/system/resource");

    return {
      "cpu-load": data?.["cpu-load"], 
      "total-memory": data?.["total-memory"],
      "free-memory": data?.["free-memory"],
      uptime: data?.uptime
    };
  }

  async ping(target, count = 10, intervalMs = 450) {
    const body = { address: target, count, interval: `${intervalMs}ms` };
    const { data } = await this.http.post("/tool/ping", body);
    return data.map(r => ({
      sent: r?.sent,
      received: r?.received,
      time: r?.time
    }));
  }

  async getInterfaces() {
    const { data } = await this.http.get("/interface");
    return data.map(iface => ({
      id: iface?.[".id"],
      name: iface?.name,
      type: iface?.type,
      running: iface?.running,
      disabled: iface?.disabled
    }));
  }

  async topCpuTasks(duration = 3) {
    const { data } = await this.http.post("/tool/profile", { duration: `${duration}s` });
    const rows = Array.isArray(data) ? data : [];
    return rows
      .map(r => ({
        name: r?.name,
        usage: Number(r?.usage) || 0
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
  }
}