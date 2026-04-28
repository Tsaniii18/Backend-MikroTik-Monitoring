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
    // ambil data identitas perangkat
    const { data: identity } = await this.http.get("/system/identity");

    // ambil data resource perangkat
    const { data: resource } = await this.http.get("/system/resource");

    return {
      name: identity?.name, // nama perangkat
      version: resource?.version, // versi RouterOS
      platform: resource?.platform, // platform perangkat
      cpu: resource?.cpu, // tipe CPU
      cpu_count: Number(resource?.["cpu-count"]), // jumlah core CPU
      architecture_name: resource?.["architecture-name"], // arsitektur
      total_memory: Number(resource?.["total-memory"]), // total memori (byte)
      board_name: resource?.["board-name"], // nama board
    };
  }

  async getResource() {
    const { data } = await this.http.get("/system/resource"); // request resource

    return {
      "cpu-load": data?.["cpu-load"], // CPU load
      "total-memory": data?.["total-memory"], // total memory
      "free-memory": data?.["free-memory"], // free memory
      uptime: data?.uptime // uptime perangkat
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
    return rows.map(r => ({
      name: r?.name,
      usage: r?.usage
    }));
  }
}