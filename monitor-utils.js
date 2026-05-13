// monitor-utils.js — derived metrics, thresholds, status flags for the supervisory monitor
// Loaded after data.js; expects window.haitiData to be built before any function call.

(function () {
  // Thresholds: { ok: range or threshold for "normal", watch: ..., alert: ... }
  // direction: "high" = higher is better, "low" = lower is better
  const THRESHOLDS = {
    car:         { dir: "high", alert: 12, watch: 15, name: "CAR" }, // regulatory floor 12%
    capToAssets: { dir: "high", alert: 6, watch: 8,  name: "Cap / Assets" },
    npl:         { dir: "low",  alert: 10, watch: 5, name: "NPL" },
    provCov:     { dir: "high", alert: 0.5, watch: 0.7, name: "Prov. cov." },
    netNplEq:    { dir: "low",  alert: 25, watch: 10, name: "Net NPL / Equity" },
    liqA:        { dir: "high", alert: 15, watch: 25, name: "Liq / Assets" },
    liqD:        { dir: "high", alert: 20, watch: 30, name: "Liq / Deposits" },
    roa:         { dir: "high", alert: 0,  watch: 1, name: "ROA (YTD)" },
    roe:         { dir: "high", alert: 0,  watch: 8, name: "ROE (YTD)" },
  };

  // Status: alert | watch | ok
  function statusFor(key, value) {
    if (value == null) return "na";
    const t = THRESHOLDS[key];
    if (!t) return "na";
    if (t.dir === "high") {
      if (value < t.alert) return "alert";
      if (value < t.watch) return "watch";
      return "ok";
    } else {
      if (value > t.alert) return "alert";
      if (value > t.watch) return "watch";
      return "ok";
    }
  }

  // HHI of system assets (0–10000 scale), based on share_of_system_assets (in %)
  function hhi(qIndex) {
    const data = window.haitiData;
    let s = 0;
    for (const b of data.banks) {
      const v = b.series[qIndex].share;
      if (v != null) s += v * v; // shares already in %, so HHI in (0..10000) range
    }
    return s;
  }

  // Loan-to-deposit ratio (system)
  function ldr(qIndex, source) {
    const data = window.haitiData;
    const s = source || data.system[qIndex];
    if (s.netLoans == null || s.deposits == null || s.deposits === 0) return null;
    return (s.netLoans / s.deposits) * 100;
  }
  function bankLdr(bank, qIndex) {
    const s = bank.series[qIndex];
    if (s.netLoans == null || s.deposits == null || s.deposits === 0) return null;
    return (s.netLoans / s.deposits) * 100;
  }

  // z-score of a value vs the series' 10y history (last min(N, 40) quarters)
  function zScore(seriesArr, value, lookback = 40) {
    if (value == null) return null;
    const start = Math.max(0, seriesArr.length - lookback);
    const slice = seriesArr.slice(start).filter(v => v != null && Number.isFinite(v));
    if (slice.length < 4) return null;
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((s, v) => s + (v - mean) * (v - mean), 0) / slice.length;
    const sd = Math.sqrt(variance);
    if (sd === 0) return 0;
    return (value - mean) / sd;
  }

  // Percentile range of series (returns [p10, p25, p50, p75, p90])
  function percentiles(seriesArr) {
    const v = seriesArr.filter(x => x != null && Number.isFinite(x)).sort((a, b) => a - b);
    if (v.length === 0) return null;
    const pct = (p) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
    return { p10: pct(0.1), p25: pct(0.25), p50: pct(0.5), p75: pct(0.75), p90: pct(0.9), min: v[0], max: v[v.length - 1] };
  }

  // Year-over-year delta of a metric (current minus 4Q-prior)
  function yoyDelta(seriesArr, qIndex) {
    const cur = seriesArr[qIndex];
    const prev = seriesArr[Math.max(0, qIndex - 4)];
    if (cur == null || prev == null) return null;
    return cur - prev;
  }

  // System-level series for a metric
  function systemSeries(key) {
    return window.haitiData.system.map(s => s[key]);
  }

  // Per-bank series for a metric
  function bankSeries(bank, key) { return bank.series.map(s => s[key]); }

  // Number formatting
  function fmtPct(v, d = 2) { return v == null ? "—" : v.toFixed(d) + "%"; }
  function fmtBp(v) {
    if (v == null) return "—";
    const bp = v * 100;
    const sign = bp >= 0 ? "+" : "";
    return `${sign}${bp.toFixed(0)} bp`;
  }
  function fmtPp(v, d = 2) {
    if (v == null) return "—";
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(d)} pp`;
  }
  function fmtBig(htgBn) {
    if (htgBn == null) return "—";
    if (htgBn >= 1000) return (htgBn / 1000).toFixed(2) + "T";
    if (htgBn >= 10) return htgBn.toFixed(1) + "B";
    return htgBn.toFixed(2) + "B";
  }
  function fmtZ(z) { return z == null ? "—" : (z >= 0 ? "+" : "") + z.toFixed(2) + "σ"; }

  // Map status -> color
  const STATUS_COLOR = {
    ok:    "#5fc28b",
    watch: "#e0a64a",
    alert: "#e0635c",
    na:    "#6c7280",
  };

  // Indicator catalog — what shows on Pulse, in what order
  const HEALTH_INDICATORS = [
    { key: "car",          group: "Capital",       label: "CAR",                    fmt: (v) => fmtPct(v, 1), short: "Capital adequacy" },
    { key: "capToAssets",  group: "Capital",       label: "Capital / Assets",       fmt: (v) => fmtPct(v, 2), short: "Capital ratio" },
    { key: "npl",          group: "Asset quality", label: "NPL ratio",              fmt: (v) => fmtPct(v, 2), short: "Non-performing loans" },
    { key: "provCov",      group: "Asset quality", label: "Provision cov.",         fmt: (v) => v == null ? "—" : v.toFixed(2) + "×", short: "Provisions / NPLs" },
    { key: "liqA",         group: "Liquidity",     label: "Liq / Assets",           fmt: (v) => fmtPct(v, 1), short: "Liquid assets ratio" },
    { key: "liqD",         group: "Liquidity",     label: "Liq / Deposits",         fmt: (v) => fmtPct(v, 1), short: "Liquidity / deposits" },
    { key: "roa",          group: "Profitability", label: "ROA (YTD)",              fmt: (v) => fmtPct(v, 2), short: "Return on assets" },
    { key: "roe",          group: "Profitability", label: "ROE (YTD)",              fmt: (v) => fmtPct(v, 1), short: "Return on equity" },
  ];

  // Worse status across bank-level for a given indicator (used for system rollup)
  function systemStatusFromBanks(key, qIndex) {
    let worst = "ok";
    const rank = { ok: 0, watch: 1, alert: 2, na: -1 };
    for (const b of window.haitiData.banks) {
      const v = b.series[qIndex][key];
      const s = statusFor(key, v);
      if (rank[s] > rank[worst]) worst = s;
    }
    return worst;
  }

  window.haitiMonitor = {
    THRESHOLDS, statusFor, hhi, ldr, bankLdr,
    zScore, percentiles, yoyDelta,
    systemSeries, bankSeries,
    fmtPct, fmtBp, fmtPp, fmtBig, fmtZ,
    STATUS_COLOR, HEALTH_INDICATORS, systemStatusFromBanks,
  };
})();
