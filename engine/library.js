export const CONFIG = {
  windowsLength: 12,
  pollingIntervalMs: 5000,
  interfaceIntervalMs: 2000,
  eventCooldownMs: 120000,
  correlationWindowMs: 90000
};

export const RULES = {
  R1: { id: "R1", type: "Gangguan Konektivitas Interface" },
  R2: { id: "R2", threshold: 250, type: "Degradasi Delay Jaringan" },
  R3: { id: "R3", threshold: 3, type: "Packet Loss Tinggi" },
  R4: { id: "R4", threshold: 80, type: "Beban CPU Berlebih" }
};

export const CORRELATION = {
  C1: { 
    id: "C1", 
    description: "Indikasi degradasi QoS pada sisi upstream.ISP",
    suggestion: "Periksa jalur upstream/ISP, beban trafik, dan kondisi jaringan eksternal (upstream) karena resource router normal."
  },
  C2: {
    id: "C2", 
    description: "Indikasi degradasi QoS yang disebabkan karena degradasi resource perangkat", 
    suggestion: "Periksa beban CPU/proses yang tinggi dan optimasi konfigurasi (queue/firewall), pertimbangkan peningkatan resource."
  }
};