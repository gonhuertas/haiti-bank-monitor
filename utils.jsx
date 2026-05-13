// Shared utilities: formatters, data accessors, sample inflation series.

// Bank display order + canonical list
const BANK_ORDER = ["UNIBK", "SOGEBK", "BNC", "CAPITALBK", "BUH", "SOGEBL", "CBNA", "BPH", "BHD", "PROMOBK", "SCOTIA", "SOCABK"];
const SYSTEM_KEY = "SYSTÈME";
const SYSTEM_W_KEY = "SYSTÈME (weighted)";

// Bank long names (rough — analyst will know these, but tooltips help)
const BANK_LONG = {
  UNIBK: "Unibank",
  SOGEBK: "Sogebank",
  BNC: "Banque Nationale de Crédit",
  CAPITALBK: "Capital Bank",
  BUH: "Banque de l'Union Haïtienne",
  SOGEBL: "Sogebel",
  CBNA: "Citibank Haïti (CBNA)",
  BPH: "Banque Populaire Haïtienne",
  BHD: "Banque Haïtienne de Développement",
  PROMOBK: "Promobank",
  SCOTIA: "Scotiabank Haïti",
  SOCABK: "Société Caraïbéenne de Banque"
};

window.BANK_ORDER = BANK_ORDER;
window.SYSTEM_KEY = SYSTEM_KEY;
window.SYSTEM_W_KEY = SYSTEM_W_KEY;
window.BANK_LONG = BANK_LONG;

// ——— Formatters ———

window.fmt = {
  pct(v, dp = 1) {
    if (v == null || isNaN(v)) return "—";
    return (v * 100).toFixed(dp) + "%";
  },
  pctSigned(v, dp = 1) {
    if (v == null || isNaN(v)) return "—";
    const s = (v * 100).toFixed(dp);
    return (v > 0 ? "+" : "") + s + "%";
  },
  ppSigned(v, dp = 1) {
    if (v == null || isNaN(v)) return "—";
    const s = (v * 100).toFixed(dp);
    return (v > 0 ? "+" : "") + s + " pp";
  },
  htg(v, dp = 1) {
    if (v == null || isNaN(v)) return "—";
    return v.toFixed(dp);
  },
  mult(v, dp = 2) {
    if (v == null || isNaN(v)) return "—";
    return v.toFixed(dp) + "×";
  },
  qtr(dateStr) {
    if (!dateStr) return "—";
    const [y, m] = dateStr.split("-");
    const month = parseInt(m);
    const q = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
    return q + " " + y;
  },
  qtrShort(dateStr) {
    if (!dateStr) return "—";
    const [y, m] = dateStr.split("-");
    const month = parseInt(m);
    const q = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
    return q + "'" + y.slice(2);
  },
  monthYear(dateStr) {
    if (!dateStr) return "—";
    const [y, m] = dateStr.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[parseInt(m)-1] + " " + y;
  }
};

// ——— Data accessors ———

window.getData = function() { return window.__BANK_DATA; };

// Get series for one bank, one indicator. Returns [{date, value}, ...] sorted asc by date.
window.bankSeries = function(indicator, bank) {
  const d = window.__BANK_DATA[indicator];
  if (!d) return [];
  const out = [];
  for (const row of d.series) {
    if (row[bank] !== undefined) {
      out.push({ date: row.date, value: row[bank] });
    }
  }
  return out.sort((a,b) => a.date.localeCompare(b.date));
};

// Get all dates for an indicator (asc)
window.indicatorDates = function(indicator) {
  const d = window.__BANK_DATA[indicator];
  if (!d) return [];
  return d.series.map(r => r.date).sort();
};

// Get latest value for a bank+indicator.
window.latest = function(indicator, bank) {
  const s = window.bankSeries(indicator, bank);
  return s.length ? s[s.length - 1] : null;
};

// Get value at a specific date for a bank+indicator.
window.atDate = function(indicator, bank, date) {
  const d = window.__BANK_DATA[indicator];
  if (!d) return null;
  for (const row of d.series) {
    if (row.date === date && row[bank] !== undefined) return row[bank];
  }
  return null;
};

// Active banks at a given date (have any non-null in core indicators)
window.activeBanksAt = function(date) {
  const checks = ['total_assets', 'capital_to_assets', 'car'];
  const set = new Set();
  for (const ind of checks) {
    const d = window.__BANK_DATA[ind];
    if (!d) continue;
    const row = d.series.find(r => r.date === date);
    if (!row) continue;
    for (const b of BANK_ORDER) {
      if (row[b] !== undefined && row[b] !== null) set.add(b);
    }
  }
  return BANK_ORDER.filter(b => set.has(b));
};

// All quarter dates available across the workbook (asc)
window.allDates = function() {
  const set = new Set();
  for (const k of Object.keys(window.__BANK_DATA)) {
    for (const row of window.__BANK_DATA[k].series) set.add(row.date);
  }
  return [...set].sort();
};

// QoQ / YoY change for a bank's series
window.qoq = function(series) {
  if (series.length < 2) return null;
  const last = series[series.length - 1].value;
  const prev = series[series.length - 2].value;
  if (prev === 0 || prev == null) return null;
  return (last - prev) / Math.abs(prev);
};
window.yoy = function(series) {
  if (series.length < 5) return null;
  const last = series[series.length - 1].value;
  const prev = series[series.length - 5].value;
  if (prev === 0 || prev == null) return null;
  return (last - prev) / Math.abs(prev);
};

// ——— Sample inflation series (CPI YoY, Haiti) ———
// Stand-in. Will be replaced with real BRH/IHSI CPI.
window.SAMPLE_CPI_YOY = {
  "2017-12-31": 0.135, "2018-03-31": 0.139, "2018-06-30": 0.135,
  "2018-09-30": 0.138, "2018-12-31": 0.158, "2019-03-31": 0.171,
  "2019-06-30": 0.196, "2019-09-30": 0.193, "2019-12-31": 0.205,
  "2020-03-31": 0.220, "2020-06-30": 0.236, "2020-09-30": 0.245,
  "2020-12-31": 0.215, "2021-03-31": 0.180, "2021-06-30": 0.140,
  "2021-09-30": 0.105, "2021-12-31": 0.137, "2022-03-31": 0.260,
  "2022-06-30": 0.290, "2022-09-30": 0.310, "2022-12-31": 0.385,
  "2023-03-31": 0.493, "2023-06-30": 0.420, "2023-09-30": 0.260,
  "2023-12-31": 0.227, "2024-03-31": 0.227, "2024-06-30": 0.260,
  "2024-09-30": 0.270, "2024-12-31": 0.300, "2025-03-31": 0.320,
  "2025-06-30": 0.340, "2025-09-30": 0.310, "2025-12-31": 0.295
};

// Compute YoY real loan growth = (1+nominal) / (1+cpi) - 1
window.realYoY = function(nominalYoY, dateStr, cpiOverride) {
  const cpi = (cpiOverride && cpiOverride[dateStr] != null) ? cpiOverride[dateStr] : window.SAMPLE_CPI_YOY[dateStr];
  if (cpi == null || nominalYoY == null) return null;
  return (1 + nominalYoY) / (1 + cpi) - 1;
};

// ——— Sample FX open-position data (stand-in) ———
// User will replace with real BRH circulaire 86 monitoring data.

window.SAMPLE_FX_DATA = (function() {
  // Per-bank quarterly net open FX position as % of regulatory capital
  // and days-breached count per quarter.
  // Limit assumed at ±20% (BRH Circulaire 86 typical).
  const banks = BANK_ORDER.filter(b => b !== "PROMOBK" && b !== "SCOTIA" && b !== "SOCABK" && b !== "BHD");
  const dates = ["2024-03-31","2024-06-30","2024-09-30","2024-12-31","2025-03-31","2025-06-30","2025-09-30","2025-12-31"];

  // Mostly within limits, some banks pushing edges, occasional breaches
  const seed = (s) => { let x = s; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
  const out = {};
  banks.forEach((b, bi) => {
    out[b] = { positions: [], breachDays: [] };
    const r = seed((bi + 1) * 173 + 41);
    let pos = (r() - 0.5) * 0.18;
    dates.forEach((d, di) => {
      // random walk with persistence
      pos = pos * 0.6 + (r() - 0.5) * 0.16;
      // a few banks get pushed near limits in 2025
      if (b === "BNC" && di >= 4) pos += 0.06 * (di - 3);
      if (b === "BUH" && di >= 5) pos += 0.05 * (di - 4);
      if (b === "BPH" && di >= 6) pos -= 0.08 * (di - 5);
      pos = Math.max(-0.42, Math.min(0.42, pos));
      out[b].positions.push({ date: d, value: pos });
      // breach days
      const tightness = Math.abs(pos) / 0.20;
      let days = 0;
      if (tightness > 1.0) days = Math.round(15 + r() * 50);
      else if (tightness > 0.85) days = Math.round(r() * 8);
      else days = 0;
      out[b].breachDays.push({ date: d, value: days });
    });
  });
  return { banks, dates, data: out, limit: 0.20 };
})();
