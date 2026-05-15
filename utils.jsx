// Shared utilities: formatters, data accessors, real-rate helpers.
// Inflation data is loaded by app.jsx from cpi_data.json (real Haiti CPI
// from the IMF, refreshed via build_cpi_data.py).

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

// ——— Inflation series (CPI YoY, Haiti) ———
// Real Haiti CPI data is loaded by app.jsx into window.__CPI_DATA (full
// monthly + quarterly series from the IMF) and window.CPI_YOY (a quarter-end
// keyed lookup map for convenience). window.SAMPLE_CPI_YOY is kept as an
// alias for backward compatibility with code that still uses the old name —
// they point at the same object now.
//
// To refresh:  python build_cpi_data.py  → regenerates cpi_data.json from IMF.

// Compute YoY real loan growth from a YoY nominal growth.
//   real = (1 + nominal) / (1 + inflation) − 1
// Uses window.CPI_YOY by default; the caller can pass cpiOverride to plug in
// a manual scenario (used by the inline CPI editor in Credit Dynamics).
window.realYoY = function(nominalYoY, dateStr, cpiOverride) {
  const lookup = (cpiOverride && cpiOverride[dateStr] != null)
    ? cpiOverride[dateStr]
    : (window.CPI_YOY && window.CPI_YOY[dateStr]);
  if (lookup == null || nominalYoY == null) return null;
  return (1 + nominalYoY) / (1 + lookup) - 1;
};

// Fisher-deflate any nominal annualized rate (ROA, ROE, deposit yield, …)
// to its real equivalent at the inflation rate prevailing at `dateStr`.
//   real_rate = (1 + nominal_rate) / (1 + inflation_yoy) − 1
// Returns null if either input is missing. The rate convention must match —
// pass annualized YTD ROA against YoY inflation; pass quarterly ROA against
// the equivalent quarterly inflation if you have it.
window.realRate = function(nominalRate, dateStr, cpiOverride) {
  return window.realYoY(nominalRate, dateStr, cpiOverride);
};

// Look up the YoY inflation rate at any quarter-end date. Returns null if
// the date isn't in the loaded CPI series. Convenience accessor for charts /
// briefing / methodology that just want the inflation print.
window.cpiYoYAt = function(dateStr) {
  return (window.CPI_YOY && window.CPI_YOY[dateStr] != null) ? window.CPI_YOY[dateStr] : null;
};

// FX open-position data is now loaded by app.jsx into window.__FX_DATA from
// fx_data.json (built by build_fx_data.py from the BRH posinette CSV).
// The previous SAMPLE_FX_DATA placeholder has been removed.
