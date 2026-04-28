export const nowWibIso = () => new Date().toISOString();

export const clampWindow = (arr, max) => {
  if (arr.length > max) arr.splice(0, arr.length - max);
  return arr;
};

export const pushWindow = (arr, item, max) => {
  arr.push(item);
  return clampWindow(arr, max);
};

export const avg = (arr) => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

export const min = (arr) => (arr.length ? Math.min(...arr) : 0);
export const max = (arr) => (arr.length ? Math.max(...arr) : 0);


export const bps = (deltaBytes, deltaMs) => {
  if (!Number.isFinite(deltaBytes) || !Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return (deltaBytes * 8) / (deltaMs / 1000);
};

export const safeJson = (v) => {
  try { return JSON.parse(JSON.stringify(v)); } catch { return null; }
};

export const parseTimeMs = (v) => {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  const m1 = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(ms|us|s)$/i);
  if (m1) {
    const num = Number(m1[1]);
    const unit = m1[2].toLowerCase();
    if (!Number.isFinite(num)) return 0;
    if (unit === "ms") return num;
    if (unit === "us") return num / 1000;
    if (unit === "s") return num * 1000;
  }
  const m2 = s.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (m2) {
    const hh = Number(m2[1]);
    const mm = Number(m2[2]);
    const ss = Number(m2[3]);
    if ([hh, mm, ss].every(Number.isFinite)) {
      return (hh * 3600 + mm * 60 + ss) * 1000;
    }
  }
  const num = Number.parseFloat(s);
  return Number.isFinite(num) ? num : 0;
};

export const parsePercent = (v) => {
  if (v == null) return 0;
  const s = String(v).trim();
  const num = parseFloat(s.replace("%", ""));
  return Number.isFinite(num) ? num : 0;
};

export const parseMiB = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v / (1024 * 1024);
  }
  const s = String(v).trim();
  const match = s.match(/^([0-9.]+)\s*(MiB|KiB|GiB|B)/i);
  if (match) {
    let value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === "KIB") value /= 1024;
    else if (unit === "GIB") value *= 1024;
    else if (unit === "B") value /= (1024 * 1024);
    return Number.isFinite(value) ? value : 0;
  }
  const num = Number.parseFloat(s);
  if (Number.isFinite(num)) {
    return num / (1024 * 1024);
  }
  return 0;
};

export const windowStats = (windowArray, key) => {
  const arr = windowArray || [];
  const values = arr
    .map((x) => Number(x[key]))
    .filter((n) => Number.isFinite(n));
  return {
    count: values.length,
    avg: values.length
      ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
      : 0,
    min: values.length ? Number(Math.min(...values).toFixed(2)) : 0,
    max: values.length ? Number(Math.max(...values).toFixed(2)) : 0,
  };
};

export const windowStatsPacketLoss = (window) => {
  const totalSent = window.reduce((sum, w) => {
    const v = Number(w?.packetSent);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  const totalReceived = window.reduce((sum, w) => {
    const v = Number(w?.packetReceive);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  const totalLoss = Math.max(0, totalSent - totalReceived);

  const lossPct = totalSent > 0
    ? (totalLoss / totalSent) * 100
    : 0;

  return {
    totalSent,
    totalReceived,
    totalLoss,
    lossPct: Number(lossPct.toFixed(2)),
  };
};