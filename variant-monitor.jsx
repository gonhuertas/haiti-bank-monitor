// variant-monitor.jsx — "Banking Sector Monitor"
// Dark supervisory dashboard for analysts already familiar with the system.
// Tabs: Pulse · Cross-section · Time series · Bank monitor
//
// Reuses window.haitiData + window.haitiMonitor utilities.

const { useState: useStateM, useMemo: useMemoM, useEffect: useEffectM } = React;

// Brighter palette for the dark theme (overrides bank.color for monitor only).
// Explicit overrides keep the seven legacy tickers visually stable; new banks
// fall back to a positional palette so the dashboard degrades gracefully if the
// bank universe ever changes.
const MONITOR_BANK_COLORS = {
  UNIBK:     "#5aa0ff",
  SOGEBK:    "#e89455",
  BNC:       "#f3c95c",
  CAPITALBK: "#5fc28b",
  BUH:       "#d96a8e",
  SOGEBL:    "#6cc6e6",
  BPH:       "#b29ddf",
};
const PALETTE_FALLBACK = ["#9aa2ad", "#c2855f", "#88b86c", "#a890d4", "#d4a553", "#7a9eb1", "#b56c84"];

function bankColor(ticker) {
  if (MONITOR_BANK_COLORS[ticker]) return MONITOR_BANK_COLORS[ticker];
  const idx = window.haitiData?.banks?.findIndex(b => b.ticker === ticker) ?? -1;
  return idx >= 0 ? PALETTE_FALLBACK[idx % PALETTE_FALLBACK.length] : PALETTE_FALLBACK[0];
}

function VariantMonitor() {
  const data = window.haitiData;
  const M = window.haitiMonitor;
  const [tab, setTab] = useStateM("pulse");
  const [qIndex, setQIndex] = useStateM(data.N_QUARTERS - 1);
  // Default to the largest bank by share-of-system in the latest quarter.
  // Falls back to the first available bank if no shares are reported.
  const initialBank = (() => {
    const ranked = [...data.banks].sort((a, b) =>
      (b.series[data.N_QUARTERS - 1].share ?? 0) - (a.series[data.N_QUARTERS - 1].share ?? 0)
    );
    return ranked[0]?.ticker ?? data.banks[0]?.ticker ?? "";
  })();
  const [selectedBank, setSelectedBank] = useStateM(initialBank);
  const [xsMetric, setXsMetric] = useStateM("npl");
  const [tsMetric, setTsMetric] = useStateM("npl");
  const [tsTransform, setTsTransform] = useStateM("level");
  const [tsBanks, setTsBanks] = useStateM(data.banks.map(b => b.ticker));
  const [tsShowSystem, setTsShowSystem] = useStateM(true);

  const cur = data.quarters[qIndex];

  // Bank size order (for prev/next)
  const sizeOrder = [...data.banks].sort((a, b) => (b.series[qIndex].share ?? 0) - (a.series[qIndex].share ?? 0)).map(b => b.ticker);

  return (
    <div className="vM-root" data-screen-label={`Monitor.${tab}`}>
      <style>{`
        .vM-root {
          --bg:        #14171c;
          --surface-1: #1a1f27;
          --surface-2: #232932;
          --surface-3: #2c333d;
          --border:    #2d3640;
          --border-soft:#222831;
          --text:      #e6e9ee;
          --text-2:    #b0b8c2;
          --text-dim:  #7a8290;
          --text-faint:#5a626d;
          --accent:    #d4a553;
          --accent-2:  #b88a40;
          --ok:        #5fc28b;
          --watch:     #e8a04a;
          --alert:     #e8665e;
          --info:      #5aa0ff;
          --mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
          --sans: "Inter", system-ui, -apple-system, sans-serif;
          background: var(--bg);
          color: var(--text);
          font-family: var(--sans);
          font-size: 13px;
          width: 1440px;
          min-height: 900px;
          display: flex;
          flex-direction: column;
        }
        .vM-root * { box-sizing: border-box; }

        /* Top bar */
        .vM-topbar {
          display: flex;
          align-items: stretch;
          background: var(--surface-1);
          border-bottom: 1px solid var(--border);
          font-family: var(--mono);
        }
        .vM-brand {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 20px;
          border-right: 1px solid var(--border);
        }
        .vM-brand .glyph {
          width: 28px; height: 28px;
          background: var(--accent);
          color: var(--bg);
          font-family: var(--mono); font-weight: 700; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
          letter-spacing: -0.05em;
        }
        .vM-brand .name { font-family: var(--mono); font-size: 13px; font-weight: 600; letter-spacing: 0.04em; color: var(--text); }
        .vM-brand .name small { display: block; font-size: 9px; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-dim); margin-top: 3px; }

        .vM-meta {
          display: flex; align-items: stretch;
          margin-left: auto;
        }
        .vM-meta .pair { padding: 0 20px; display: flex; flex-direction: column; justify-content: center; border-left: 1px solid var(--border); }
        .vM-meta .pair .l { font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; }
        .vM-meta .pair .v { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--text); margin-top: 2px; font-variant-numeric: tabular-nums; }

        .vM-period {
          display: flex; align-items: center; gap: 10px;
          padding: 0 18px;
          border-left: 1px solid var(--border);
          background: var(--surface-2);
        }
        .vM-period button {
          width: 28px; height: 28px;
          border: 1px solid var(--border);
          background: var(--surface-1);
          color: var(--text-2);
          font-family: var(--mono); font-size: 13px;
          cursor: pointer; transition: all 0.1s;
          padding: 0;
        }
        .vM-period button:hover { color: var(--accent); border-color: var(--accent); }
        .vM-period .label { font-family: var(--mono); font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; }
        .vM-period .qtag { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--accent); min-width: 64px; text-align: center; font-variant-numeric: tabular-nums; }

        /* Tab bar */
        .vM-tabs {
          display: flex;
          background: var(--surface-1);
          border-bottom: 1px solid var(--border);
        }
        .vM-tab {
          padding: 11px 22px;
          font-family: var(--mono); font-size: 11px;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--text-dim);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          font-weight: 600;
          display: flex; align-items: center; gap: 8px;
        }
        .vM-tab:hover { color: var(--text); }
        .vM-tab.active { color: var(--text); border-bottom-color: var(--accent); }
        .vM-tab .num {
          font-family: var(--mono); font-size: 9px;
          color: var(--text-faint); font-weight: 500;
          letter-spacing: 0;
        }
        .vM-tab.active .num { color: var(--accent); }

        /* Body */
        .vM-body { flex: 1; padding: 20px 24px 28px; }

        /* Generic card */
        .vM-card { background: var(--surface-1); border: 1px solid var(--border); }
        .vM-card-head {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; border-bottom: 1px solid var(--border);
          background: var(--surface-2);
        }
        .vM-card-head .title { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: var(--text); }
        .vM-card-head .sub { font-family: var(--mono); font-size: 10px; color: var(--text-dim); margin-left: auto; }
        .vM-card-body { padding: 14px; }

        /* Status pip */
        .vM-pip { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
        .vM-pip.ok    { background: var(--ok); box-shadow: 0 0 6px rgba(95,194,139,0.5); }
        .vM-pip.watch { background: var(--watch); box-shadow: 0 0 6px rgba(232,160,74,0.55); }
        .vM-pip.alert { background: var(--alert); box-shadow: 0 0 8px rgba(232,102,94,0.6); animation: vM-pulse 1.8s ease-in-out infinite; }
        .vM-pip.na    { background: var(--text-faint); }
        @keyframes vM-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }

        /* Status text */
        .vM-status-text.ok    { color: var(--ok); }
        .vM-status-text.watch { color: var(--watch); }
        .vM-status-text.alert { color: var(--alert); }

        /* Footer */
        .vM-foot {
          padding: 8px 24px;
          font-family: var(--mono); font-size: 9.5px;
          color: var(--text-dim);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          display: flex; justify-content: space-between;
          border-top: 1px solid var(--border);
          background: var(--surface-1);
        }
        .vM-foot span b { color: var(--text-2); font-weight: 600; }
      `}</style>

      {/* ── TOP BAR ──────────────────────────────────────────────── */}
      <div className="vM-topbar">
        <div className="vM-brand">
          <div className="glyph">M</div>
          <div className="name">Sector Monitor<small>BRH · Commercial Banks</small></div>
        </div>
        <div className="vM-meta">
          <SystemPulseBadge qIndex={qIndex} />
          <div className="pair"><div className="l">Banks</div><div className="v">{data.banks.length} active</div></div>
          <div className="pair"><div className="l">Coverage</div><div className="v">{data.quarters[0].label} → {data.quarters[data.N_QUARTERS - 1].label}</div></div>
          <div className="pair"><div className="l">FX</div><div className="v">{data.fx[qIndex].toFixed(2)} HTG/USD</div></div>
        </div>
        <div className="vM-period">
          <span className="label">Period</span>
          <button title="-1Q" onClick={() => setQIndex(Math.max(0, qIndex - 1))}>‹</button>
          <span className="qtag">{cur.label}</span>
          <button title="+1Q" onClick={() => setQIndex(Math.min(data.N_QUARTERS - 1, qIndex + 1))}>›</button>
          <button title="Latest" onClick={() => setQIndex(data.N_QUARTERS - 1)} style={{ width: "auto", padding: "0 8px", fontSize: 10 }}>NOW</button>
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────── */}
      <div className="vM-tabs">
        {[
          ["pulse",     "01", "Sector Pulse"],
          ["xsection",  "02", "Cross-section"],
          ["time",      "03", "Time series"],
          ["bank",      "04", "Bank monitor"],
        ].map(([k, n, l]) => (
          <div key={k} className={"vM-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
            <span className="num">{n}</span>{l}
          </div>
        ))}
      </div>

      {/* ── BODY ─────────────────────────────────────────────────── */}
      <div className="vM-body">
        {tab === "pulse"    && <MonitorPulse qIndex={qIndex} setQIndex={setQIndex} setTab={setTab} setSelectedBank={setSelectedBank} setXsMetric={setXsMetric} />}
        {tab === "xsection" && <MonitorXSection qIndex={qIndex} setQIndex={setQIndex} metric={xsMetric} setMetric={setXsMetric} setTab={setTab} setSelectedBank={setSelectedBank} />}
        {tab === "time"     && <MonitorTime metric={tsMetric} setMetric={setTsMetric} transform={tsTransform} setTransform={setTsTransform} tsBanks={tsBanks} setTsBanks={setTsBanks} tsShowSystem={tsShowSystem} setTsShowSystem={setTsShowSystem} qIndex={qIndex} setQIndex={setQIndex} />}
        {tab === "bank"     && <MonitorBank selectedBank={selectedBank} setSelectedBank={setSelectedBank} qIndex={qIndex} setQIndex={setQIndex} sizeOrder={sizeOrder} setTab={setTab} />}
      </div>

      <div className="vM-foot">
        <span>Status thresholds derived from regulatory minima + sector historical bands. z-scores computed against trailing {Math.round(M.LOOKBACK_QUARTERS / 4)}-year mean.</span>
        <span><b>Source</b> · BRH supervisory filings · indicators carry varying coverage</span>
      </div>
    </div>
  );
}

// ── System pulse badge in top bar ───────────────────────────────────
function SystemPulseBadge({ qIndex }) {
  const M = window.haitiMonitor;
  const data = window.haitiData;
  // Count alerts across all banks × all indicators
  let alerts = 0, watches = 0, total = 0;
  for (const b of data.banks) {
    for (const ind of M.HEALTH_INDICATORS) {
      const v = b.series[qIndex][ind.key];
      if (v == null) continue;
      const s = M.statusFor(ind.key, v);
      total++;
      if (s === "alert") alerts++;
      if (s === "watch") watches++;
    }
  }
  const overall = alerts > 0 ? "alert" : watches > 0 ? "watch" : "ok";
  const label = overall === "alert" ? "Alerts" : overall === "watch" ? "Watch" : "Normal";
  return (
    <div className="pair" style={{ borderLeft: "none" }}>
      <div className="l">Sector status</div>
      <div className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={"vM-pip " + overall} />
        <span className={"vM-status-text " + overall}>{label}</span>
        <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>
          {alerts > 0 && <span style={{ color: "var(--alert)" }}>{alerts}A</span>}
          {alerts > 0 && watches > 0 && " · "}
          {watches > 0 && <span style={{ color: "var(--watch)" }}>{watches}W</span>}
          {alerts === 0 && watches === 0 && <span>{total} indicators</span>}
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { VariantMonitor, MONITOR_BANK_COLORS, bankColor, SystemPulseBadge });
