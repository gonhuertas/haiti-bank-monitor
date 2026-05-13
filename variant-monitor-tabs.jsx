// variant-monitor-tabs.jsx — Cross-section, Time series, Bank monitor

const { useState: useStateMT } = React;

// ════════════════════════════════════════════════════════════════════
// CROSS-SECTION TAB
// ════════════════════════════════════════════════════════════════════
function MonitorXSection({ qIndex, setQIndex, metric, setMetric, setTab, setSelectedBank }) {
  const data = window.haitiData;
  const M = window.haitiMonitor;
  const cur = data.quarters[qIndex];
  const [sortBy, setSortBy] = useStateMT("value"); // value | z

  // Available metrics (catalog with thresholds + formatting)
  const metricCat = [
    ...M.HEALTH_INDICATORS,
    { key: "share",       group: "Structure",     label: "Market share",       fmt: v => M.fmtPct(v, 2) },
    { key: "totalAssets", group: "Structure",     label: "Total assets (B HTG)", fmt: v => M.fmtBig(v) },
    { key: "netLoans",    group: "Structure",     label: "Net loans (B HTG)",   fmt: v => M.fmtBig(v) },
    { key: "deposits",    group: "Structure",     label: "Deposits (B HTG)",    fmt: v => M.fmtBig(v) },
    { key: "netNplEq",    group: "Asset quality", label: "Net NPLs / Equity",   fmt: v => M.fmtPct(v, 1) },
  ];
  const active = metricCat.find(m => m.key === metric) || metricCat[0];
  const thresh = M.THRESHOLDS[active.key];
  const sysArr = data.system.map(s => s[active.key]);

  // Bank values for the active period
  const banks = data.banks.map(b => {
    const v = b.series[qIndex][active.key];
    const bArr = b.series.map(s => s[active.key]);
    const z = M.zScore(bArr, v);
    const prev = b.series[Math.max(0, qIndex - 4)][active.key];
    const yoy = (v != null && prev != null) ? v - prev : null;
    return {
      bank: b, value: v, z, yoy,
      status: M.statusFor(active.key, v),
      pct: M.percentiles(bArr),
    };
  }).sort((a, b) => {
    if (sortBy === "z") {
      const az = a.z == null ? -Infinity : Math.abs(a.z);
      const bz = b.z == null ? -Infinity : Math.abs(b.z);
      return bz - az;
    }
    // For "lower is better" metrics, ascending; otherwise descending
    const dir = thresh?.dir === "low" ? 1 : -1;
    if (a.value == null && b.value == null) return 0;
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    return dir * (b.value - a.value);
  });

  const sysVal = sysArr[qIndex];
  const sysPctile = M.percentiles(sysArr);

  return (
    <div className="vM-xs-root">
      <style>{`
        .vM-xs-root { display: grid; grid-template-columns: 1fr 380px; gap: 16px; }

        .vM-toolbar {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px;
          background: var(--surface-1);
          border: 1px solid var(--border);
          font-family: var(--mono);
        }
        .vM-toolbar .label { font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; }
        .vM-toolbar .group { display: flex; align-items: center; gap: 8px; padding-right: 14px; border-right: 1px solid var(--border); }
        .vM-toolbar .group:last-child { border-right: none; }
        .vM-mselect {
          background: var(--surface-2);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 6px 12px;
          font-family: var(--mono); font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          min-width: 180px;
          letter-spacing: 0.03em;
        }
        .vM-mselect:focus { outline: 1px solid var(--accent); }
        .vM-mselect option, .vM-mselect optgroup { background: var(--surface-2); color: var(--text); }
        .vM-tg { display: inline-flex; }
        .vM-tg button {
          padding: 6px 11px; border: 1px solid var(--border);
          background: var(--surface-2); color: var(--text-2);
          font-family: var(--mono); font-size: 10.5px; cursor: pointer;
          letter-spacing: 0.06em;
        }
        .vM-tg button + button { border-left: none; }
        .vM-tg button.on { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 700; }

        .vM-xs-banktable {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--mono); font-size: 11.5px;
        }
        .vM-xs-banktable th, .vM-xs-banktable td {
          padding: 9px 8px; text-align: right;
          border-bottom: 1px solid var(--border-soft);
          font-variant-numeric: tabular-nums;
        }
        .vM-xs-banktable th {
          font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--text-dim); border-bottom: 1px solid var(--border); font-weight: 600;
        }
        .vM-xs-banktable td:first-child, .vM-xs-banktable th:first-child { text-align: left; }
        .vM-xs-banktable tbody tr { cursor: pointer; transition: background 0.1s; }
        .vM-xs-banktable tbody tr:hover { background: var(--surface-2); }

        .vM-xs-status { display: inline-flex; align-items: center; gap: 6px; }
        .vM-z { font-family: var(--mono); font-size: 11px; font-weight: 600; }
        .vM-z.hi { color: var(--info); }
        .vM-z.lo { color: var(--watch); }
        .vM-z.mid { color: var(--text-dim); }

        .vM-distrib {
          background: var(--surface-1); border: 1px solid var(--border);
          padding: 14px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .vM-distrib h4 { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-2); font-weight: 700; margin: 0 0 4px; }
        .vM-distrib .legendrow { display: flex; font-family: var(--mono); font-size: 9.5px; color: var(--text-dim); gap: 12px; }
        .vM-distrib .legendrow span { display: inline-flex; align-items: center; gap: 4px; }
        .vM-distrib .legendrow span::before { content: ""; display: inline-block; width: 10px; height: 2px; background: currentColor; }
      `}</style>

      {/* MAIN COLUMN: ranking */}
      <div>
        <div className="vM-toolbar" style={{ marginBottom: 12 }}>
          <span className="group">
            <span className="label">Metric</span>
            <select className="vM-mselect" value={active.key} onChange={(e) => setMetric(e.target.value)}>
              {["Capital","Asset quality","Liquidity","Profitability","Structure"].map(g => (
                <optgroup key={g} label={g}>
                  {metricCat.filter(m => m.group === g).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </optgroup>
              ))}
            </select>
          </span>
          <span className="group">
            <span className="label">Sort</span>
            <span className="vM-tg">
              <button className={sortBy === "value" ? "on" : ""} onClick={() => setSortBy("value")}>By value</button>
              <button className={sortBy === "z" ? "on" : ""} onClick={() => setSortBy("z")}>By |z|</button>
            </span>
          </span>
          <span className="group" style={{ marginLeft: "auto" }}>
            <span className="label">Direction</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", fontWeight: 600 }}>
              {thresh ? (thresh.dir === "high" ? "↑ higher is better" : "↓ lower is better") : "—"}
            </span>
          </span>
        </div>

        <CrossSectionBarChart banks={banks} active={active} thresh={thresh} sysVal={sysVal} sysPctile={sysPctile} setSelectedBank={setSelectedBank} setTab={setTab} />

        <div className="vM-card" style={{ marginTop: 14 }}>
          <div className="vM-card-head">
            <span className="title">Bank readout · {active.label} · {cur.label}</span>
            <span className="sub">click row to open bank</span>
          </div>
          <div className="vM-card-body" style={{ padding: 0 }}>
            <table className="vM-xs-banktable">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Status</th>
                  <th>{active.label}</th>
                  <th>z (10y)</th>
                  <th>YoY Δ</th>
                  <th>10y range</th>
                  <th>vs system</th>
                </tr>
              </thead>
              <tbody>
                {banks.map(({ bank, value, z, yoy, status, pct }) => (
                  <tr key={bank.ticker} onClick={() => { setSelectedBank(bank.ticker); setTab("bank"); }}>
                    <td><span style={{ display: "inline-block", width: 4, height: 16, background: bankColor(bank.ticker), marginRight: 8, verticalAlign: "middle" }} /><span style={{ color: "var(--text)", fontWeight: 600 }}>{bank.ticker}</span></td>
                    <td><span className="vM-xs-status"><span className={"vM-pip " + status} /><span className={"vM-status-text " + status}>{status.toUpperCase()}</span></span></td>
                    <td style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>{value == null ? "—" : active.fmt(value)}</td>
                    <td className={"vM-z " + (z == null ? "mid" : Math.abs(z) > 1 ? (z > 0 ? "hi" : "lo") : "mid")}>{M.fmtZ(z)}</td>
                    <td style={{ color: yoy == null ? "var(--text-dim)" : "var(--text-2)" }}>{yoy == null ? "—" : (yoy >= 0 ? "+" : "") + yoy.toFixed(2) + (active.key === "totalAssets" || active.key === "netLoans" || active.key === "deposits" ? "" : " pp")}</td>
                    <td style={{ color: "var(--text-dim)" }}>{pct ? `${active.fmt(pct.min).replace(/[%×]/g,"")}–${active.fmt(pct.max)}` : "—"}</td>
                    <td style={{ color: "var(--text-dim)" }}>{(sysVal != null && value != null) ? (value > sysVal ? "▲" : value < sysVal ? "▼" : "=") + " " + Math.abs(value - sysVal).toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SIDE: per-bank small multiples */}
      <div>
        <div className="vM-card">
          <div className="vM-card-head">
            <span className="title">{active.label} · per-bank trend</span>
            <span className="sub">10y context</span>
          </div>
          <div className="vM-card-body" style={{ padding: 0 }}>
            {data.banks.map(b => {
              const arr = b.series.map(s => s[active.key]);
              const v = arr[qIndex];
              const pct = M.percentiles(arr);
              const status = M.statusFor(active.key, v);
              return (
                <div key={b.ticker} style={{ display: "grid", gridTemplateColumns: "76px 1fr 56px", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }} onClick={() => { setSelectedBank(b.ticker); setTab("bank"); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text)", fontWeight: 600 }}>
                    <span style={{ display: "inline-block", width: 3, height: 14, background: bankColor(b.ticker) }} />
                    {b.ticker}
                  </div>
                  <div style={{ position: "relative" }}>
                    <Sparkline data={arr} color={bankColor(b.ticker)} width={210} height={26} fill />
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, textAlign: "right", color: status === "alert" ? "var(--alert)" : status === "watch" ? "var(--watch)" : "var(--text)", fontWeight: 600 }}>
                    {v == null ? "—" : active.fmt(v)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Cross-section: horizontal bar with reference lines
function CrossSectionBarChart({ banks, active, thresh, sysVal, sysPctile, setSelectedBank, setTab }) {
  const M = window.haitiMonitor;
  const w = 920, rowH = 34, topPad = 22, botPad = 24;
  const h = topPad + banks.length * rowH + botPad;
  const valid = banks.filter(b => b.value != null);
  const vals = valid.map(b => b.value);
  let lo = Math.min(0, ...vals), hi = Math.max(...vals);
  if (thresh) { lo = Math.min(lo, thresh.alert * 0.9, thresh.watch * 0.9); hi = Math.max(hi, thresh.watch * 1.1, thresh.alert * 1.1); }
  hi = hi + (hi - lo) * 0.08;
  if (lo < 0) lo = lo - (hi - lo) * 0.05; else lo = 0;
  const xFor = v => 96 + (v - lo) / (hi - lo) * (w - 96 - 110);

  return (
    <div className="vM-card">
      <div className="vM-card-head">
        <span className="title">All banks · {active.label}</span>
        <span className="sub">ref lines: system, regulatory, 10y range</span>
      </div>
      <div className="vM-card-body">
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: "var(--mono)" }}>
          {/* x-axis */}
          <line x1={96} x2={w - 14} y1={topPad - 8} y2={topPad - 8} stroke="#2d3640" strokeWidth="0.6" />
          {/* ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const v = lo + t * (hi - lo);
            const x = xFor(v);
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={topPad - 10} y2={h - botPad} stroke="#222831" strokeWidth="0.5" strokeDasharray="2 3" />
                <text x={x} y={topPad - 12} fontSize="9" fill="#7a8290" textAnchor="middle">{active.fmt(v).replace(/×$/, "×").replace(/%$/,"")}</text>
              </g>
            );
          })}
          {/* threshold lines */}
          {thresh && [thresh.alert, thresh.watch].map((tv, i) => {
            const x = xFor(tv);
            const isAlert = i === 0;
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={topPad - 10} y2={h - botPad} stroke={isAlert ? "#e8665e" : "#e8a04a"} strokeWidth="0.9" strokeDasharray="3 3" opacity="0.75" />
                <text x={x} y={h - botPad + 12} fontSize="9" fill={isAlert ? "#e8665e" : "#e8a04a"} textAnchor="middle">{isAlert ? "alert" : "watch"} {active.fmt(tv).replace(/×$/, "×").replace(/%$/, "%")}</text>
              </g>
            );
          })}
          {/* system reference */}
          {sysVal != null && (
            <g>
              <line x1={xFor(sysVal)} x2={xFor(sysVal)} y1={topPad - 10} y2={h - botPad} stroke="#d4a553" strokeWidth="1.1" />
              <text x={xFor(sysVal)} y={h - botPad + 12} fontSize="9" fill="#d4a553" textAnchor="middle">system {active.fmt(sysVal)}</text>
            </g>
          )}
          {/* bars */}
          {banks.map((row, i) => {
            const y = topPad + i * rowH;
            const yCenter = y + rowH / 2;
            const barH = 16;
            const bcol = bankColor(row.bank.ticker);
            return (
              <g key={row.bank.ticker} style={{ cursor: "pointer" }} onClick={() => { setSelectedBank(row.bank.ticker); setTab("bank"); }}>
                {/* row hover hit area */}
                <rect x={0} y={y} width={w} height={rowH} fill="transparent">
                  <title>{row.bank.ticker} · {active.fmt(row.value)}</title>
                </rect>
                <text x={88} y={yCenter + 3.5} fontSize="11" fontWeight="600" fill="#e6e9ee" textAnchor="end">{row.bank.ticker}</text>
                {/* 10y range as faint line */}
                {row.pct && (
                  <line x1={xFor(row.pct.min)} x2={xFor(row.pct.max)} y1={yCenter} y2={yCenter} stroke="#3a4250" strokeWidth="1" />
                )}
                {row.pct && (
                  <>
                    <line x1={xFor(row.pct.min)} x2={xFor(row.pct.min)} y1={yCenter - 4} y2={yCenter + 4} stroke="#3a4250" strokeWidth="1" />
                    <line x1={xFor(row.pct.max)} x2={xFor(row.pct.max)} y1={yCenter - 4} y2={yCenter + 4} stroke="#3a4250" strokeWidth="1" />
                  </>
                )}
                {/* bar */}
                {row.value != null && (
                  <rect x={xFor(0)} y={yCenter - barH / 2} width={Math.max(1, xFor(row.value) - xFor(0))} height={barH} fill={bcol} fillOpacity={row.status === "alert" ? 0.95 : 0.7} />
                )}
                {/* status pip on right */}
                {row.value != null && (
                  <g>
                    <circle cx={xFor(row.value) + 8} cy={yCenter} r="3" fill={row.status === "alert" ? "#e8665e" : row.status === "watch" ? "#e8a04a" : row.status === "ok" ? "#5fc28b" : "#5a626d"} />
                    <text x={xFor(row.value) + 16} y={yCenter + 3.5} fontSize="11" fill="#e6e9ee" fontWeight="600">{active.fmt(row.value)}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TIME SERIES TAB
// ════════════════════════════════════════════════════════════════════
function MonitorTime({ metric, setMetric, transform, setTransform, tsBanks, setTsBanks, tsShowSystem, setTsShowSystem, qIndex, setQIndex }) {
  const data = window.haitiData;
  const M = window.haitiMonitor;

  const metricCat = [
    ...M.HEALTH_INDICATORS,
    { key: "share",       group: "Structure",     label: "Market share",       fmt: v => M.fmtPct(v, 2) },
    { key: "totalAssets", group: "Structure",     label: "Total assets",       fmt: v => M.fmtBig(v) + " HTG bn" },
    { key: "netLoans",    group: "Structure",     label: "Net loans",          fmt: v => M.fmtBig(v) + " HTG bn" },
    { key: "deposits",    group: "Structure",     label: "Deposits",           fmt: v => M.fmtBig(v) + " HTG bn" },
    { key: "netNplEq",    group: "Asset quality", label: "Net NPLs / Equity",  fmt: v => M.fmtPct(v, 1) },
  ];
  const active = metricCat.find(m => m.key === metric) || metricCat[0];

  // Build series with transform applied
  function transformArr(arr) {
    if (transform === "level") return arr;
    if (transform === "yoy") {
      // YoY change: arr[i] - arr[i-4]
      return arr.map((v, i) => (v == null || i < 4 || arr[i - 4] == null) ? null : v - arr[i - 4]);
    }
    if (transform === "z") {
      const valid = arr.filter(v => v != null && Number.isFinite(v));
      if (valid.length < 4) return arr.map(() => null);
      const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
      const sd = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length);
      if (sd === 0) return arr.map(v => v == null ? null : 0);
      return arr.map(v => v == null ? null : (v - mean) / sd);
    }
    if (transform === "idx") {
      // Indexed to 100 at first non-null value
      const base = arr.find(v => v != null);
      if (base == null || base === 0) return arr;
      return arr.map(v => v == null ? null : (v / base) * 100);
    }
    return arr;
  }

  const sysArr = transformArr(data.system.map(s => s[active.key]));
  const bankLines = data.banks
    .filter(b => tsBanks.includes(b.ticker))
    .map(b => ({ label: b.ticker, color: bankColor(b.ticker), data: transformArr(b.series.map(s => s[active.key])) }));

  const series = [
    ...bankLines,
    ...(tsShowSystem ? [{ label: "System (weighted)", color: "#d4a553", data: sysArr }] : []),
  ];

  const xLabels = data.quarters.map(q => q.q === 1 ? q.y : "");
  const fmt = (v) => {
    if (v == null) return "—";
    if (transform === "yoy") return (v >= 0 ? "+" : "") + v.toFixed(2) + " pp";
    if (transform === "z") return (v >= 0 ? "+" : "") + v.toFixed(2) + "σ";
    if (transform === "idx") return v.toFixed(0);
    return active.fmt(v);
  };

  return (
    <div>
      <div className="vM-toolbar" style={{ marginBottom: 14 }}>
        <span className="group">
          <span className="label">Metric</span>
          <select className="vM-mselect" value={active.key} onChange={(e) => setMetric(e.target.value)}>
            {["Capital","Asset quality","Liquidity","Profitability","Structure"].map(g => (
              <optgroup key={g} label={g}>
                {metricCat.filter(m => m.group === g).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </optgroup>
            ))}
          </select>
        </span>
        <span className="group">
          <span className="label">Transform</span>
          <span className="vM-tg">
            {[["level","Level"],["yoy","YoY Δ"],["z","z-score"],["idx","Indexed"]].map(([k,l]) => (
              <button key={k} className={transform === k ? "on" : ""} onClick={() => setTransform(k)}>{l}</button>
            ))}
          </span>
        </span>
        <span className="group" style={{ marginLeft: "auto" }}>
          <span className="label">Banks</span>
          {data.banks.map(b => (
            <button key={b.ticker}
              onClick={() => setTsBanks(tsBanks.includes(b.ticker) ? tsBanks.filter(x => x !== b.ticker) : [...tsBanks, b.ticker])}
              style={{
                padding: "5px 9px",
                background: tsBanks.includes(b.ticker) ? bankColor(b.ticker) : "var(--surface-2)",
                color: tsBanks.includes(b.ticker) ? "var(--bg)" : "var(--text-dim)",
                border: "1px solid " + (tsBanks.includes(b.ticker) ? bankColor(b.ticker) : "var(--border)"),
                fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                letterSpacing: 0.05 + "em",
              }}>{b.ticker}</button>
          ))}
          <button
            onClick={() => setTsShowSystem(!tsShowSystem)}
            style={{
              padding: "5px 9px",
              background: tsShowSystem ? "#d4a553" : "var(--surface-2)",
              color: tsShowSystem ? "var(--bg)" : "var(--text-dim)",
              border: "1px solid " + (tsShowSystem ? "#d4a553" : "var(--border)"),
              fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, cursor: "pointer",
            }}>SYS</button>
        </span>
      </div>

      <div className="vM-card">
        <div className="vM-card-head">
          <span className="title">{active.label} · {transform === "level" ? "level" : transform === "yoy" ? "year-over-year change" : transform === "z" ? "z-score (vs own 10y mean)" : "indexed to 100 at first observation"}</span>
          <span className="sub">{data.quarters[0].label} → {data.quarters[data.N_QUARTERS - 1].label}</span>
        </div>
        <div className="vM-card-body">
          <LineChart
            series={series}
            xLabels={xLabels}
            yFormat={fmt}
            height={360}
            strokeWidth={1.5}
            textColor="#7a8290"
            gridColor="#2d3640"
            highlightLast
          />
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-2)" }}>
            {series.map(s => (
              <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 2, background: s.color }} />{s.label}
                <span style={{ color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(s.data[s.data.length - 1])}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Small multiples — one per bank */}
      <div style={{ marginTop: 14 }} className="vM-trend-grid">
        {data.banks.map(b => {
          const arr = transformArr(b.series.map(s => s[active.key]));
          const v = arr[arr.length - 1];
          return (
            <div key={b.ticker} className="vM-trend-panel">
              <div className="head">
                <span className="title">
                  <span style={{ display: "inline-block", width: 3, height: 11, background: bankColor(b.ticker), marginRight: 6, verticalAlign: "middle" }} />
                  {b.ticker}
                </span>
                <span className="now">{fmt(v)}</span>
              </div>
              <LineChart
                series={arr}
                xLabels={xLabels}
                color={bankColor(b.ticker)}
                strokeWidth={1.3}
                height={110}
                yFormat={fmt}
                textColor="#7a8290"
                gridColor="#2d3640"
                padding={{ t: 6, r: 8, b: 18, l: 38 }}
                bands={transform === "z" ? [{ from: -1, to: 1, color: "rgba(170,178,189,0.06)" }] : []}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BANK MONITOR TAB — single-bank health panel
// ════════════════════════════════════════════════════════════════════
function MonitorBank({ selectedBank, setSelectedBank, qIndex, setQIndex, sizeOrder, setTab }) {
  const data = window.haitiData;
  const M = window.haitiMonitor;
  const bank = data.banks.find(b => b.ticker === selectedBank);
  const s = bank.series[qIndex];
  const sp = bank.series[Math.max(0, qIndex - 4)];
  const cur = data.quarters[qIndex];
  const rank = sizeOrder.indexOf(selectedBank) + 1;
  const prevB = sizeOrder[(rank - 2 + sizeOrder.length) % sizeOrder.length];
  const nextB = sizeOrder[rank % sizeOrder.length];

  // Count statuses
  let alerts = 0, watches = 0;
  for (const ind of M.HEALTH_INDICATORS) {
    const status = M.statusFor(ind.key, s[ind.key]);
    if (status === "alert") alerts++;
    if (status === "watch") watches++;
  }
  const overall = alerts > 0 ? "alert" : watches > 0 ? "watch" : "ok";

  return (
    <div>
      <style>{`
        .vM-bank-head {
          display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 18px;
          padding: 14px 16px;
          background: var(--surface-1);
          border: 1px solid var(--border);
          margin-bottom: 14px;
        }
        .vM-bank-head .strip { width: 6px; height: 56px; }
        .vM-bank-head .name { font-family: var(--mono); font-size: 26px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
        .vM-bank-head .full { font-family: var(--sans); font-size: 12.5px; color: var(--text-dim); font-weight: 500; margin-top: 2px; }
        .vM-bank-head .stat-pack { display: flex; gap: 22px; font-family: var(--mono); }
        .vM-bank-head .stat-pack .pair .l { font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; }
        .vM-bank-head .stat-pack .pair .v { font-size: 16px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; margin-top: 2px; }
        .vM-bank-head .stat-pack .pair .v small { font-size: 10px; font-weight: 500; color: var(--text-dim); }
        .vM-bank-nav button {
          width: 30px; height: 30px;
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); font-family: var(--mono); font-size: 14px;
          cursor: pointer;
        }
        .vM-bank-nav button:hover { color: var(--accent); border-color: var(--accent); }
        .vM-bank-nav { display: flex; gap: 4px; align-items: center; }
        .vM-bank-nav .pos { font-family: var(--mono); font-size: 10.5px; color: var(--text-dim); margin: 0 6px; }
        .vM-bank-chips { display: flex; gap: 4px; }
        .vM-bank-chip {
          padding: 4px 9px; border: 1px solid var(--border);
          background: var(--surface-2); color: var(--text-dim);
          font-family: var(--mono); font-size: 10.5px; cursor: pointer; font-weight: 600;
        }
        .vM-bank-chip.on { background: var(--surface-3); color: var(--text); border-color: var(--accent); }

        .vM-status-banner {
          padding: 10px 16px;
          background: var(--surface-1);
          border: 1px solid var(--border);
          margin-bottom: 14px;
          display: flex; align-items: center; gap: 14px;
          font-family: var(--mono); font-size: 11px;
        }
        .vM-status-banner.alert { border-left: 3px solid var(--alert); }
        .vM-status-banner.watch { border-left: 3px solid var(--watch); }
        .vM-status-banner.ok    { border-left: 3px solid var(--ok); }
        .vM-status-banner .head { font-size: 13px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
        .vM-status-banner.alert .head { color: var(--alert); }
        .vM-status-banner.watch .head { color: var(--watch); }
        .vM-status-banner.ok    .head { color: var(--ok); }
        .vM-status-banner .counts { color: var(--text-2); font-size: 11.5px; }
        .vM-status-banner .counts .c { color: var(--text); font-weight: 700; padding: 0 3px; }

        .vM-bank-pulse-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
          margin-bottom: 14px;
        }
        .vM-bank-detail {
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
        }
        .vM-bank-bs {
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px;
          background: var(--border);
          margin-bottom: 1px;
        }
        .vM-bank-bs .cell {
          background: var(--surface-1); padding: 12px 14px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .vM-bank-bs .cell .l { font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; }
        .vM-bank-bs .cell .v { font-family: var(--mono); font-size: 18px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.1; margin-top: 2px; }
        .vM-bank-bs .cell .d { font-family: var(--mono); font-size: 10px; color: var(--text-dim); margin-top: 2px; font-variant-numeric: tabular-nums; }
        .vM-bank-bs .cell .d .pos { color: var(--ok); }
        .vM-bank-bs .cell .d .neg { color: var(--alert); }
      `}</style>

      {/* Header */}
      <div className="vM-bank-head">
        <div className="strip" style={{ background: bankColor(bank.ticker) }} />
        <div>
          <div className="name">{bank.ticker}</div>
          <div className="full">{bank.name} · Rank #{rank} of {sizeOrder.length} by assets · {cur.label}</div>
        </div>
        <div className="stat-pack">
          <div className="pair"><div className="l">Share</div><div className="v">{M.fmtPct(s.share, 2)}</div></div>
          <div className="pair"><div className="l">Assets</div><div className="v">{M.fmtBig(s.totalAssets)} <small>HTG</small></div></div>
          <div className="pair"><div className="l">LDR</div><div className="v">{M.fmtPct(M.bankLdr(bank, qIndex), 0)}</div></div>
          <div className="pair"><div className="l">CAR</div><div className="v">{M.fmtPct(s.car, 1)}</div></div>
        </div>
        <div className="vM-bank-nav">
          <button onClick={() => setSelectedBank(prevB)} title={"Prev: " + prevB}>‹</button>
          <span className="pos">{rank}/{sizeOrder.length}</span>
          <button onClick={() => setSelectedBank(nextB)} title={"Next: " + nextB}>›</button>
        </div>
      </div>

      {/* Bank chips */}
      <div className="vM-bank-chips" style={{ marginBottom: 14 }}>
        {data.banks.map(b => (
          <div key={b.ticker} className={"vM-bank-chip" + (b.ticker === selectedBank ? " on" : "")} onClick={() => setSelectedBank(b.ticker)}>
            <span style={{ display: "inline-block", width: 6, height: 6, background: bankColor(b.ticker), marginRight: 6, verticalAlign: "middle" }} />
            {b.ticker}
          </div>
        ))}
      </div>

      {/* Status banner */}
      <div className={"vM-status-banner " + overall}>
        <span className={"vM-pip " + overall} />
        <span className="head">{overall === "alert" ? "Alert" : overall === "watch" ? "Watch" : "All Normal"}</span>
        <span className="counts">
          {alerts > 0 && <><span className="c" style={{ color: "var(--alert)" }}>{alerts}</span>alert{alerts === 1 ? "" : "s"}</>}
          {alerts > 0 && watches > 0 && " · "}
          {watches > 0 && <><span className="c" style={{ color: "var(--watch)" }}>{watches}</span>watch{watches === 1 ? "" : "es"}</>}
          {alerts === 0 && watches === 0 && <>all {M.HEALTH_INDICATORS.length} core indicators within sector tolerance</>}
        </span>
        <span style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          z-scores computed vs {bank.ticker}'s own 10y history
        </span>
      </div>

      {/* Per-bank health indicators (same shape as Pulse, but bank-level) */}
      <div className="vM-bank-pulse-grid">
        {M.HEALTH_INDICATORS.map(ind => <BankIndicatorCard key={ind.key} bank={bank} ind={ind} qIndex={qIndex} />)}
      </div>

      {/* Balance sheet snapshot */}
      <div className="vM-bank-bs">
        {[
          ["Total assets",      s.totalAssets, sp.totalAssets, "%"],
          ["Gross loans",       s.grossLoans,  sp.grossLoans,  "%"],
          ["Net loans",         s.netLoans,    sp.netLoans,    "%"],
          ["Deposits",          s.deposits,    sp.deposits,    "%"],
          ["Equity",            s.equity,      sp.equity,      "%"],
          ["Reg. capital",      s.regCapital,  sp.regCapital,  "%"],
          ["Risk-weighted A.",  s.rwa,         sp.rwa,         "%"],
          ["LDR",               M.bankLdr(bank, qIndex), M.bankLdr(bank, Math.max(0, qIndex - 4)), "pp"],
        ].slice(0, 8).map(([l, v, p, kind], i) => {
          const d = (v != null && p != null && p !== 0) ? (kind === "pp" ? v - p : ((v - p) / p) * 100) : null;
          return (
            <div className="cell" key={i}>
              <div className="l">{l}</div>
              <div className="v">{l === "LDR" ? (v != null ? v.toFixed(1) + "%" : "—") : M.fmtBig(v) + (v != null ? " HTG" : "")}</div>
              <div className="d">YoY <span className={d == null ? "" : d >= 0 ? "pos" : "neg"}>{d == null ? "—" : (d >= 0 ? "+" : "") + d.toFixed(1) + (kind === "pp" ? " pp" : "%")}</span></div>
            </div>
          );
        })}
      </div>

      {/* Detail trends */}
      <div className="vM-bank-detail" style={{ marginTop: 14 }}>
        <BankTrend bank={bank} metrics={[{ key: "npl", color: "#e8665e", label: "NPL ratio" }, { key: "provCov", color: "#5fc28b", label: "Prov. coverage (×)" }]} title="Asset quality" fmt={v => v == null ? "—" : v.toFixed(2)} />
        <BankTrend bank={bank} metrics={[{ key: "car", color: "#5aa0ff", label: "CAR (%)" }, { key: "capToAssets", color: "#d4a553", label: "Cap/Assets (%)" }]} title="Capital" fmt={v => v == null ? "—" : v.toFixed(1) + "%"} />
        <BankTrend bank={bank} metrics={[{ key: "roa", color: "#5fc28b", label: "ROA (%)" }, { key: "roe", color: "#5aa0ff", label: "ROE (%)" }]} title="Profitability" fmt={v => v == null ? "—" : v.toFixed(1) + "%"} />
        <BankTrend bank={bank} metrics={[{ key: "liqA", color: "#6cc6e6", label: "Liq/Assets (%)" }, { key: "liqD", color: "#a890d4", label: "Liq/Deposits (%)" }]} title="Liquidity" fmt={v => v == null ? "—" : v.toFixed(0) + "%"} />
      </div>
    </div>
  );
}

function BankIndicatorCard({ bank, ind, qIndex }) {
  const M = window.haitiMonitor;
  const data = window.haitiData;
  const arr = bank.series.map(s => s[ind.key]);
  const v = arr[qIndex];
  const prev = arr[Math.max(0, qIndex - 4)];
  const sysArr = data.system.map(s => s[ind.key]);
  const sysV = sysArr[qIndex];
  const status = M.statusFor(ind.key, v);
  const z = M.zScore(arr, v);
  const delta = (v != null && prev != null) ? v - prev : null;

  const w = 280, h = 50;
  const valid = arr.filter(v => v != null && Number.isFinite(v));
  if (valid.length === 0) return <div className="vM-indicator-card" style={{ opacity: 0.4 }}><div className="row1"><span className={"vM-pip na"} /><span className="grp">{ind.group}</span><span className="name">{ind.label}</span></div><div className="row2"><span className="val">—</span></div></div>;
  let lo = Math.min(...valid), hi = Math.max(...valid);
  const yPad = (hi - lo) * 0.12 || 1;
  const yMin = lo - yPad, yMax = hi + yPad;
  const xFor = i => 2 + (i / (arr.length - 1)) * (w - 4);
  const yFor = val => 4 + (1 - (val - yMin) / (yMax - yMin)) * (h - 8);
  let path = "", inSeg = false;
  arr.forEach((val, i) => {
    if (val == null) { inSeg = false; return; }
    path += `${inSeg ? "L" : "M"}${xFor(i).toFixed(1)} ${yFor(val).toFixed(1)} `;
    inSeg = true;
  });

  return (
    <div className="vM-indicator-card">
      <div className="row1">
        <span className={"vM-pip " + status} />
        <span className="grp">{ind.group}</span>
        <span className="name">{ind.label}</span>
      </div>
      <div className="row2">
        <span className="val">{ind.fmt(v)}</span>
        <span className={"delta " + (delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "dn" : "flat")}>
          {delta == null ? "" : (delta >= 0 ? "+" : "") + (Math.abs(delta) * 100 >= 100 ? delta.toFixed(2) + " pp" : (delta * 100).toFixed(0) + " bp")}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="spark" style={{ width: "100%", height: h }}>
        {sysV != null && yFor(sysV) >= 0 && yFor(sysV) <= h && (
          <line x1={2} x2={w - 2} y1={yFor(sysV)} y2={yFor(sysV)} stroke="rgba(212,165,83,0.5)" strokeWidth="0.7" strokeDasharray="3 3" />
        )}
        <path d={path} fill="none" stroke="var(--text)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {v != null && <circle cx={xFor(qIndex)} cy={yFor(v)} r="2.8" fill={status === "alert" ? "var(--alert)" : status === "watch" ? "var(--watch)" : "var(--ok)"} />}
      </svg>
      <div className="row3">
        <span className="vs-mean">z {M.fmtZ(z)} · vs sys {sysV == null || v == null ? "—" : (v >= sysV ? "▲" : "▼") + (Math.abs(v - sysV)).toFixed(2)}</span>
        <span className="thresh">{M.THRESHOLDS[ind.key] ? `${M.THRESHOLDS[ind.key].dir === "high" ? "≥" : "≤"}${M.THRESHOLDS[ind.key].watch}` : ""}</span>
      </div>
    </div>
  );
}

function BankTrend({ bank, metrics, title, fmt }) {
  const data = window.haitiData;
  const xLabels = data.quarters.map(q => q.q === 1 ? q.y : "");
  const sysSeries = window.haitiData.system;

  return (
    <div className="vM-card">
      <div className="vM-card-head">
        <span className="title">{title}</span>
        <span className="sub">solid: {bank.ticker} · dashed: system</span>
      </div>
      <div className="vM-card-body">
        <LineChart
          series={metrics.flatMap(m => ([
            { label: m.label, color: m.color, data: bank.series.map(s => s[m.key]) },
            { label: m.label + " · sys", color: m.color, data: sysSeries.map(s => s[m.key]) }, // we'll style dashed via opacity workaround
          ]))}
          xLabels={xLabels}
          yFormat={fmt}
          textColor="#7a8290"
          gridColor="#2d3640"
          height={180}
          strokeWidth={1.3}
        />
        <div style={{ display: "flex", gap: 14, marginTop: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-2)" }}>
          {metrics.map(m => {
            const v = bank.series[bank.series.length - 1][m.key];
            const sv = sysSeries[sysSeries.length - 1][m.key];
            return (
              <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 14, height: 2, background: m.color }} /><b style={{ color: "var(--text)" }}>{m.label}</b>
                <span style={{ color: "var(--text-dim)" }}>· now {fmt(v)} · sys {fmt(sv)}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MonitorXSection, CrossSectionBarChart, MonitorTime, MonitorBank, BankIndicatorCard, BankTrend });
