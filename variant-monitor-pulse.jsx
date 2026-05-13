// variant-monitor-pulse.jsx — Pulse tab: system snapshot + bank deviation heatmap + trends

const { useState: useStatePulse } = React;

function MonitorPulse({ qIndex, setQIndex, setTab, setSelectedBank, setXsMetric }) {
  const data = window.haitiData;
  const M = window.haitiMonitor;
  const cur = data.quarters[qIndex];

  return (
    <div className="vM-pulse-root">
      <style>{`
        .vM-pulse-root {
          display: flex; flex-direction: column; gap: 20px;
        }

        /* Section header */
        .vM-section-head {
          display: flex; align-items: baseline; gap: 14px;
          font-family: var(--mono); font-size: 10px;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--text-dim); font-weight: 700;
        }
        .vM-section-head .num { color: var(--accent); font-weight: 700; }
        .vM-section-head .lbl { color: var(--text); }
        .vM-section-head .rule { flex: 1; height: 1px; background: var(--border); }
        .vM-section-head .sub { color: var(--text-dim); font-weight: 500; letter-spacing: 0.12em; }

        /* Health indicator grid */
        .vM-pulse-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
        }
        .vM-indicator-card {
          background: var(--surface-1);
          border: 1px solid var(--border);
          padding: 14px 14px 12px;
          display: flex; flex-direction: column; gap: 6px;
          position: relative;
        }
        .vM-indicator-card .row1 { display: flex; align-items: center; gap: 9px; font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; }
        .vM-indicator-card .row1 .grp { color: var(--text-faint); font-size: 9px; }
        .vM-indicator-card .row1 .grp::after { content: "·"; margin: 0 7px; color: var(--text-faint); }
        .vM-indicator-card .row1 .name { color: var(--text-2); }
        .vM-indicator-card .row2 { display: flex; align-items: baseline; gap: 12px; }
        .vM-indicator-card .val { font-family: var(--mono); font-size: 28px; font-weight: 700; color: var(--text); line-height: 1; font-variant-numeric: tabular-nums; }
        .vM-indicator-card .delta { font-family: var(--mono); font-size: 11px; font-variant-numeric: tabular-nums; }
        .vM-indicator-card .delta.up { color: var(--ok); }
        .vM-indicator-card .delta.dn { color: var(--alert); }
        .vM-indicator-card .delta.flat { color: var(--text-dim); }
        .vM-indicator-card .row3 { font-family: var(--mono); font-size: 9.5px; color: var(--text-dim); display: flex; justify-content: space-between; margin-top: 2px; }
        .vM-indicator-card .row3 .vs-mean { font-variant-numeric: tabular-nums; }
        .vM-indicator-card .row3 .thresh { color: var(--text-faint); }
        .vM-indicator-card .spark { margin-top: 4px; }

        /* Heatmap */
        .vM-heatmap-wrap { overflow: hidden; }
        .vM-heatmap {
          display: grid;
          grid-template-columns: 90px repeat(8, 1fr);
          gap: 0;
          font-family: var(--mono);
          font-size: 11.5px;
        }
        .vM-heatmap .hd { background: var(--surface-2); padding: 8px 10px; font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border-soft); text-align: center; }
        .vM-heatmap .hd:first-child { text-align: left; }
        .vM-heatmap .rowhd { background: var(--surface-2); padding: 8px 12px; font-family: var(--mono); font-size: 12px; color: var(--text); font-weight: 600; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border-soft); display: flex; align-items: center; cursor: pointer; }
        .vM-heatmap .rowhd:hover { background: var(--surface-3); color: var(--accent); }
        .vM-heatmap .rowhd .arrow { color: var(--text-faint); margin-left: auto; opacity: 0; transition: opacity 0.1s; }
        .vM-heatmap .rowhd:hover .arrow { opacity: 1; color: var(--accent); }
        .vM-heatmap .cell {
          padding: 10px 8px;
          border-right: 1px solid var(--border-soft);
          border-bottom: 1px solid var(--border-soft);
          text-align: center;
          display: flex; flex-direction: column; gap: 1px; align-items: center; justify-content: center;
          cursor: pointer;
          position: relative;
          transition: filter 0.1s;
        }
        .vM-heatmap .cell:hover { filter: brightness(1.15); }
        .vM-heatmap .cell .v { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 12px; line-height: 1.1; }
        .vM-heatmap .cell .z { font-size: 9.5px; opacity: 0.7; font-variant-numeric: tabular-nums; }
        .vM-heatmap .cell.na { background: var(--surface-2); color: var(--text-faint); }
        .vM-heatmap .cell.na .v { font-size: 13px; }

        /* Snapshot grid (concentration, size, etc.) */
        .vM-snap-grid {
          display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px;
        }

        /* Mini size table inside snap */
        .vM-mini-tab { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 11.5px; }
        .vM-mini-tab th, .vM-mini-tab td { padding: 6px 6px; text-align: right; font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--border-soft); }
        .vM-mini-tab th { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; border-bottom: 1px solid var(--border); }
        .vM-mini-tab td:first-child, .vM-mini-tab th:first-child { text-align: left; }
        .vM-mini-tab tbody tr { cursor: pointer; }
        .vM-mini-tab tbody tr:hover { background: var(--surface-2); }
        .vM-mini-tab td .swatch { display: inline-block; width: 4px; height: 16px; vertical-align: middle; margin-right: 8px; }
        .vM-mini-tab td .ticker { color: var(--text); font-weight: 600; font-family: var(--mono); }

        /* Concentration card */
        .vM-conc {
          padding: 16px 14px;
          background: var(--surface-1);
          border: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 10px;
        }
        .vM-conc .row {
          display: flex; justify-content: space-between; align-items: baseline;
          font-family: var(--mono); font-size: 11px;
        }
        .vM-conc .row .l { color: var(--text-dim); letter-spacing: 0.1em; text-transform: uppercase; font-size: 10px; }
        .vM-conc .row .v { color: var(--text); font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
        .vM-conc .row .v .delta { font-size: 10px; margin-left: 6px; font-weight: 500; }

        /* Trend mini panels */
        .vM-trend-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .vM-trend-panel {
          background: var(--surface-1);
          border: 1px solid var(--border);
          padding: 12px 14px 10px;
        }
        .vM-trend-panel .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .vM-trend-panel .head .title { font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-2); font-weight: 700; }
        .vM-trend-panel .head .now { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
        .vM-trend-panel .meta { font-family: var(--mono); font-size: 9.5px; color: var(--text-dim); display: flex; justify-content: space-between; margin-top: 4px; }
      `}</style>

      {/* ── Sector health row ──────────────────────────────────── */}
      <div className="vM-section-head">
        <span className="num">01</span><span className="lbl">Sector Health Indicators</span>
        <span className="rule" />
        <span className="sub">{cur.label} · system-weighted · vs {data.quarters[Math.max(0, qIndex - 4)].label}</span>
      </div>
      <div className="vM-pulse-grid">
        {M.HEALTH_INDICATORS.map(ind => <IndicatorCard key={ind.key} ind={ind} qIndex={qIndex} onClick={() => { setXsMetric(ind.key); setTab("xsection"); }} />)}
      </div>

      {/* ── Bank × indicator deviation heatmap ─────────────────── */}
      <div className="vM-section-head" style={{ marginTop: 6 }}>
        <span className="num">02</span><span className="lbl">Bank × Indicator Stress Map</span>
        <span className="rule" />
        <span className="sub">cell colour = status · subscript = z vs 10y mean · click any bank to drill</span>
      </div>
      <div className="vM-card vM-heatmap-wrap">
        <div className="vM-heatmap">
          <div className="hd">Bank</div>
          {M.HEALTH_INDICATORS.map(ind => (
            <div key={ind.key} className="hd" title={ind.short}>{ind.label}</div>
          ))}
          {data.banks.map(b => (
            <React.Fragment key={b.ticker}>
              <div className="rowhd" onClick={() => { setSelectedBank(b.ticker); setTab("bank"); }}>
                <span style={{ display: "inline-block", width: 4, height: 18, background: bankColor(b.ticker), marginRight: 8 }} />
                <span>{b.ticker}</span>
                <span className="arrow">›</span>
              </div>
              {M.HEALTH_INDICATORS.map(ind => {
                const v = b.series[qIndex][ind.key];
                const status = M.statusFor(ind.key, v);
                const z = M.zScore(b.series.map(s => s[ind.key]), v);
                const bgCol = status === "alert" ? "rgba(232,102,94,0.22)" : status === "watch" ? "rgba(232,160,74,0.18)" : status === "ok" ? "rgba(95,194,139,0.14)" : "transparent";
                const fgCol = status === "alert" ? "var(--alert)" : status === "watch" ? "var(--watch)" : status === "ok" ? "var(--ok)" : "var(--text-faint)";
                return (
                  <div key={ind.key}
                       className={"cell" + (status === "na" ? " na" : "")}
                       style={{ background: bgCol }}
                       onClick={() => { setSelectedBank(b.ticker); setTab("bank"); }}
                       title={`${b.ticker} · ${ind.label} = ${ind.fmt(v)} · z = ${M.fmtZ(z)} · ${status}`}>
                    <span className="v" style={{ color: fgCol }}>{v == null ? "—" : ind.fmt(v)}</span>
                    {z != null && <span className="z" style={{ color: fgCol }}>{M.fmtZ(z)}</span>}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Snapshot (size, concentration, ranking) ─────────────── */}
      <div className="vM-section-head" style={{ marginTop: 6 }}>
        <span className="num">03</span><span className="lbl">Structure &amp; Concentration</span>
        <span className="rule" />
      </div>
      <div className="vM-snap-grid">
        <div className="vM-card">
          <div className="vM-card-head">
            <span className="title">Banks by size</span>
            <span className="sub">{cur.label} · click row to open profile</span>
          </div>
          <div className="vM-card-body">
            <table className="vM-mini-tab">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Share</th>
                  <th>Assets</th>
                  <th>Net loans</th>
                  <th>Deposits</th>
                  <th>LDR</th>
                  <th>NPL</th>
                  <th>YoY assets</th>
                </tr>
              </thead>
              <tbody>
                {[...data.banks].sort((a, b) => (b.series[qIndex].share ?? 0) - (a.series[qIndex].share ?? 0)).map(b => {
                  const s = b.series[qIndex];
                  const sp = b.series[Math.max(0, qIndex - 4)];
                  const yoy = sp.totalAssets ? ((s.totalAssets - sp.totalAssets) / sp.totalAssets) * 100 : null;
                  const ldr = M.bankLdr(b, qIndex);
                  return (
                    <tr key={b.ticker} onClick={() => { setSelectedBank(b.ticker); setTab("bank"); }}>
                      <td><span className="swatch" style={{ background: bankColor(b.ticker) }} /><span className="ticker">{b.ticker}</span></td>
                      <td>{M.fmtPct(s.share, 2)}</td>
                      <td>{M.fmtBig(s.totalAssets)}</td>
                      <td>{M.fmtBig(s.netLoans)}</td>
                      <td>{M.fmtBig(s.deposits)}</td>
                      <td>{M.fmtPct(ldr, 0)}</td>
                      <td style={{ color: s.npl > 10 ? "var(--alert)" : s.npl > 5 ? "var(--watch)" : "var(--text)" }}>{M.fmtPct(s.npl, 2)}</td>
                      <td style={{ color: yoy >= 0 ? "var(--ok)" : "var(--alert)" }}>{yoy == null ? "—" : (yoy >= 0 ? "+" : "") + yoy.toFixed(1) + "%"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ConcentrationCard qIndex={qIndex} />
        <SystemTotalsCard qIndex={qIndex} />
      </div>

      {/* ── Sector trends ─────────────────────────────────────── */}
      <div className="vM-section-head" style={{ marginTop: 6 }}>
        <span className="num">04</span><span className="lbl">Sector Trends</span>
        <span className="rule" />
        <span className="sub">10-year quarterly · weighted system aggregates · shaded = current period</span>
      </div>
      <div className="vM-trend-grid">
        <TrendMini metric="npl" label="NPL ratio" fmt={v => v?.toFixed(2) + "%"} qIndex={qIndex} threshold={[5, 10]} dir="low" />
        <TrendMini metric="car" label="CAR" fmt={v => v?.toFixed(1) + "%"} qIndex={qIndex} threshold={[12, 15]} dir="high" />
        <TrendMini metric="roa" label="ROA (YTD)" fmt={v => v?.toFixed(2) + "%"} qIndex={qIndex} threshold={[0, 1]} dir="high" />
        <TrendMini metric="capToAssets" label="Capital / Assets" fmt={v => v?.toFixed(2) + "%"} qIndex={qIndex} threshold={[6, 8]} dir="high" />
        <TrendMini metric="liqA" label="Liquidity / Assets" fmt={v => v?.toFixed(1) + "%"} qIndex={qIndex} threshold={[15, 25]} dir="high" />
        <TrendMini metric="totalAssets" label="Total assets (HTG bn)" fmt={v => v == null ? "—" : window.haitiMonitor.fmtBig(v)} qIndex={qIndex} />
      </div>
    </div>
  );
}

// ── Indicator card with sparkline + historical band ─────────────────
function IndicatorCard({ ind, qIndex, onClick }) {
  const data = window.haitiData;
  const M = window.haitiMonitor;
  const sysArr = data.system.map(s => s[ind.key]);
  const v = sysArr[qIndex];
  const prev = sysArr[Math.max(0, qIndex - 4)];
  const delta = (v != null && prev != null) ? (v - prev) : null;
  const status = M.statusFor(ind.key, v);
  const thresh = M.THRESHOLDS[ind.key];
  const z = M.zScore(sysArr, v);
  const pct = M.percentiles(sysArr.slice(Math.max(0, qIndex - 39), qIndex + 1));

  const w = 280, h = 50;

  // Render mini chart with band
  const allVals = sysArr.filter(v => v != null && Number.isFinite(v));
  if (allVals.length === 0) {
    return (
      <div className="vM-indicator-card" style={{ opacity: 0.45, cursor: "default" }}>
        <div className="row1">
          <span className="vM-pip na" />
          <span className="grp">{ind.group}</span>
          <span className="name">{ind.label}</span>
        </div>
        <div className="row2"><span className="val">—</span></div>
        <div className="row3"><span>no system series</span><span></span></div>
      </div>
    );
  }
  const lo = pct ? Math.min(pct.min, v ?? pct.min) : Math.min(...allVals);
  const hi = pct ? Math.max(pct.max, v ?? pct.max) : Math.max(...allVals);
  const yPad = (hi - lo) * 0.12 || 1;
  const yMin = lo - yPad, yMax = hi + yPad;
  const xFor = (i) => 2 + (i / (sysArr.length - 1)) * (w - 4);
  const yFor = (val) => 4 + (1 - (val - yMin) / (yMax - yMin)) * (h - 8);
  let path = "", inSeg = false;
  sysArr.forEach((val, i) => {
    if (val == null) { inSeg = false; return; }
    path += `${inSeg ? "L" : "M"}${xFor(i).toFixed(1)} ${yFor(val).toFixed(1)} `;
    inSeg = true;
  });

  // Threshold band shading
  const tBand = (() => {
    if (!thresh) return null;
    let from, to;
    if (thresh.dir === "high") {
      // bad below alert; values below alert are bad
      from = yMin; to = thresh.alert;
    } else {
      from = thresh.alert; to = yMax;
    }
    if (from < to) return { from, to };
    return null;
  })();

  return (
    <div className="vM-indicator-card" onClick={onClick} style={{ cursor: "pointer" }}>
      <div className="row1">
        <span className={"vM-pip " + status} />
        <span className="grp">{ind.group}</span>
        <span className="name">{ind.label}</span>
      </div>
      <div className="row2">
        <span className="val">{v == null ? "—" : ind.fmt(v)}</span>
        <span className={"delta " + (delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "dn" : "flat")}>
          {delta == null ? "" : (delta >= 0 ? "+" : "") + (Math.abs(delta) * 100 >= 100 ? delta.toFixed(2) + " pp" : (delta * 100).toFixed(0) + " bp")}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="spark" style={{ width: "100%", height: h }}>
        {tBand && (
          <rect x={2} y={yFor(tBand.to)} width={w - 4} height={Math.max(0, yFor(tBand.from) - yFor(tBand.to))} fill="rgba(232,102,94,0.06)" />
        )}
        {/* Reference line at watch threshold */}
        {thresh && (
          <line x1={2} x2={w - 2} y1={yFor(thresh.watch)} y2={yFor(thresh.watch)} stroke="rgba(232,160,74,0.45)" strokeWidth="0.6" strokeDasharray="2 3" />
        )}
        {/* Mean line */}
        {pct && (
          <line x1={2} x2={w - 2} y1={yFor(pct.p50)} y2={yFor(pct.p50)} stroke="rgba(170,178,189,0.25)" strokeWidth="0.5" strokeDasharray="1 2" />
        )}
        <path d={path} fill="none" stroke="var(--text)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {v != null && <circle cx={xFor(qIndex)} cy={yFor(v)} r="2.6" fill={status === "alert" ? "var(--alert)" : status === "watch" ? "var(--watch)" : "var(--ok)"} />}
      </svg>
      <div className="row3">
        <span className="vs-mean">z {M.fmtZ(z)}</span>
        <span className="thresh">{thresh ? `${thresh.dir === "high" ? "≥" : "≤"}${thresh.watch}${ind.key === "provCov" ? "×" : "%"} ok` : "—"}</span>
      </div>
    </div>
  );
}

// ── Concentration card (HHI + top-3 share) ─────────────────────
function ConcentrationCard({ qIndex }) {
  const data = window.haitiData;
  const M = window.haitiMonitor;
  const cur = data.quarters[qIndex];
  const hhi = M.hhi(qIndex);
  const top3 = [...data.banks].sort((a, b) => (b.series[qIndex].share ?? 0) - (a.series[qIndex].share ?? 0)).slice(0, 3);
  const top3Share = top3.reduce((s, b) => s + (b.series[qIndex].share ?? 0), 0);
  const hhiArr = data.quarters.map((_, i) => M.hhi(i));
  const top3Arr = data.quarters.map((_, i) => [...data.banks].sort((a, b) => (b.series[i].share ?? 0) - (a.series[i].share ?? 0)).slice(0,3).reduce((s, b) => s + (b.series[i].share ?? 0), 0));
  const hhi1y = hhiArr[Math.max(0, qIndex - 4)];
  // HHI interpretation: <1500 unconcentrated, 1500-2500 moderate, >2500 highly concentrated
  const hhiStatus = hhi > 2500 ? "alert" : hhi > 1500 ? "watch" : "ok";

  return (
    <div className="vM-card">
      <div className="vM-card-head">
        <span className="title">Concentration</span>
        <span className="sub">{cur.label}</span>
      </div>
      <div className="vM-card-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 600 }}>Herfindahl-Hirschman (HHI)</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 700, color: hhiStatus === "alert" ? "var(--alert)" : hhiStatus === "watch" ? "var(--watch)" : "var(--ok)" }}>{Math.round(hhi).toLocaleString()}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>
                {hhi1y != null ? ((hhi - hhi1y) >= 0 ? "+" : "") + Math.round(hhi - hhi1y) : ""} YoY
              </span>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
              {hhi > 2500 ? "highly concentrated" : hhi > 1500 ? "moderately concentrated" : "unconcentrated"} · DOJ threshold 2500
            </div>
            <Sparkline data={hhiArr} color={hhiStatus === "alert" ? "#e8665e" : hhiStatus === "watch" ? "#e8a04a" : "#5fc28b"} width={260} height={28} fill />
          </div>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 600 }}>Top-3 share of system assets</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 700, color: "var(--text)" }}>{top3Share.toFixed(1)}%</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{top3.map(b => b.ticker).join(" · ")}</span>
            </div>
            <Sparkline data={top3Arr} color="var(--accent)" width={260} height={24} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── System totals card ──────────────────────────────────────
function SystemTotalsCard({ qIndex }) {
  const data = window.haitiData;
  const M = window.haitiMonitor;
  const cur = data.quarters[qIndex];
  const sys = data.system[qIndex];
  const sysP = data.system[Math.max(0, qIndex - 4)];
  const ldr = M.ldr(qIndex);
  const ldrP = M.ldr(Math.max(0, qIndex - 4));

  const rows = [
    ["Total assets",  M.fmtBig(sys.totalAssets), sysP.totalAssets ? ((sys.totalAssets - sysP.totalAssets) / sysP.totalAssets) * 100 : null, "%"],
    ["Net loans",     M.fmtBig(sys.netLoans),    sysP.netLoans ? ((sys.netLoans - sysP.netLoans) / sysP.netLoans) * 100 : null, "%"],
    ["Deposits",      M.fmtBig(sys.deposits),    sysP.deposits ? ((sys.deposits - sysP.deposits) / sysP.deposits) * 100 : null, "%"],
    ["Equity",        M.fmtBig(sys.equity),      sysP.equity ? ((sys.equity - sysP.equity) / sysP.equity) * 100 : null, "%"],
    ["Reg. capital",  M.fmtBig(sys.regCapital),  sysP.regCapital ? ((sys.regCapital - sysP.regCapital) / sysP.regCapital) * 100 : null, "%"],
    ["LDR",           ldr != null ? ldr.toFixed(1) + "%" : "—", ldrP != null && ldr != null ? ldr - ldrP : null, "pp"],
  ];

  return (
    <div className="vM-card">
      <div className="vM-card-head">
        <span className="title">System totals · HTG bn</span>
        <span className="sub">YoY</span>
      </div>
      <div className="vM-card-body" style={{ padding: "8px 14px 12px" }}>
        <table className="vM-mini-tab">
          <tbody>
            {rows.map(([l, v, d, kind], i) => (
              <tr key={i} style={{ cursor: "default" }} onClick={(e) => e.preventDefault()}>
                <td style={{ color: "var(--text-2)" }}>{l}</td>
                <td style={{ color: "var(--text)", fontWeight: 700 }}>{v}</td>
                <td style={{ color: d == null ? "var(--text-dim)" : d >= 0 ? "var(--ok)" : "var(--alert)", width: 60 }}>
                  {d == null ? "—" : (d >= 0 ? "+" : "") + d.toFixed(1) + (kind === "pp" ? " pp" : "%")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Trend mini panel (one indicator) ────────────────────────
function TrendMini({ metric, label, fmt, qIndex, threshold = null, dir = "high" }) {
  const data = window.haitiData;
  const arr = data.system.map(s => s[metric]);
  const v = arr[qIndex];
  const xLabels = data.quarters.map(q => q.q === 1 ? q.y : "");

  const bands = threshold ? [{
    from: dir === "high" ? -Infinity : threshold[0],
    to:   dir === "high" ? threshold[0] : Infinity,
    color: "rgba(232,102,94,0.06)",
  }] : [];

  return (
    <div className="vM-trend-panel">
      <div className="head">
        <span className="title">{label}</span>
        <span className="now">{fmt(v)}</span>
      </div>
      <LineChart
        series={arr}
        xLabels={xLabels}
        color="#e6e9ee"
        strokeWidth={1.3}
        height={130}
        yFormat={fmt}
        textColor="#7a8290"
        gridColor="#2d3640"
        padding={{ t: 8, r: 10, b: 22, l: 36 }}
        bands={bands.length ? bands.map(b => ({ ...b, from: Math.max(-1e6, b.from), to: Math.min(1e6, b.to) })) : []}
        highlightLast
      />
      <div className="meta">
        <span>{data.quarters[0].label}</span>
        <span>{data.quarters[data.N_QUARTERS - 1].label}</span>
      </div>
    </div>
  );
}

Object.assign(window, { MonitorPulse, IndicatorCard, ConcentrationCard, SystemTotalsCard, TrendMini });
