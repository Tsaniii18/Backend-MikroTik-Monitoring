export const LIB = {
  windows: {
    cpu: { intervalMs: 2000, max: 30 },
    ping: { intervalMs: 5000, max: 12 }
  },
  thresholds: {
    latencyAvgMs: 250,
    packetLossAvgPct: 3,
    cpuAvgPct: 80
  },
  interfaceIntervalMs: 2000,
  cooldownMs: 2 * 60 * 1000,
  correlationWindowMs: 90 * 1000
};

export const RULES = {
  R1: { id: "R1", type: "Gangguan Konektivitas Interface" },
  R2: { id: "R2", type: "Degradasi Delay Jaringan" },
  R3: { id: "R3", type: "Packet Loss Tinggi" },
  R4: { id: "R4", type: "Beban CPU Berlebih" }
};

export const CORR = {
  C1: { id: "C1", description: "Indikasi degradasi QoS pada sisi upstream.ISP" },
  C2: { id: "C2", description: "Indikasi degradasi QoS yang disebabkan karena degradasi resource perangkat" }
};

export const SUGGESTION = {
  C1: "Periksa jalur upstream/ISP, beban trafik, dan kondisi jaringan eksternal (upstream) karena resource router normal.",
  C2: "Periksa beban CPU/proses yang tinggi dan optimasi konfigurasi (queue/firewall), pertimbangkan peningkatan resource."
};