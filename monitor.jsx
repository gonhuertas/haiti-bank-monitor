// System Monitor — overview tab.
// Restraint: 4 system-level KPIs at top, then a flags table, then 2 trajectory charts.
// No row of six mini-charts.

const { useState: _useStateM, useMemo: _useMemoM } = React;

function SystemMonitor({ asOf, onPickBank, onNavTab }) {
  const T = window.BRH_THRESHOLDS;

  // —— KPI strip: 4 indicators, trimmed to the selected as-of date ——
  // Filter to observations on or before asOf so the headline value, QoQ delta,
  // sparkline, and the trajectory cards below all reflect the dropdown choice.
  const trimToAsOf = arr => arr.filter(d => d.date <= asOf);
  const carData = trimToAsOf(window.bankSeries('car', SYSTEM_KEY));
  const nplData = trimToAsOf(window.bankSeries('npl_ratio', SYSTEM_KEY));
  const liqData = trimToAsOf(window.bankSeries('liquidity_to_deposits', SYSTEM_KEY));
  const roeData = trimToAsOf(window.bankSeries('roe', SYSTEM_KEY));

  const kpis = [
    { key: 'car', label: 'System Capital Adequacy', data: carData, format: v => fmt.pct(v, 1),
      sub: `BRH minimum ${fmt.pct(T.car_min, 0)}`, ref: T.car_min, more: 'Capital & RWA' },
    { key: 'npl', label: 'System NPL Ratio', data: nplData, format: v => fmt.pct(v, 1),
      sub: `IMF FSI watch ${fmt.pct(T.npl_watch, 0)}`, ref: T.npl_watch, more: 'Asset Quality', invert: true },
    { key: 'liq', label: 'Liquidity / Deposits', data: liqData, format: v => fmt.pct(v, 0),
      sub: `BRH minimum ${fmt.pct(T.liquidity_to_deposits_min, 0)}`, ref: T.liquidity_to_deposits_min, more: 'Liquidity' },
    { key: 'roe', label: 'System ROE (cum. FY)', data: roeData, format: v => fmt.pct(v, 1),
      sub: 'Cumulative fiscal year', ref: null, more: 'Profitability' }
  ];

  // —— Active banks at as-of date ——
  const banks = window.activeBanksAt(asOf);

  return (
    <div>
      <div className="lede" style={{ marginBottom: 18 }}>
        Quarterly supervisory dashboard as of <strong>{fmt.qtr(asOf)}</strong>. Four headline indicators at the system level, an AI-generated briefing of the quarter's developments below, and a 12-quarter trajectory for capital and asset quality.
      </div>

      {/* —— KPI strip —— */}
      <div className="kpi-strip">
        {kpis.map(k => {
          const last = k.data[k.data.length - 1];
          const prev = k.data[k.data.length - 2];
          const delta = (last && prev && prev.value != null && last.value != null) ? (last.value - prev.value) : null;
          const deltaClass = delta == null ? 'neutral' : (k.invert ? (delta < 0 ? 'up' : delta > 0 ? 'down' : 'neutral') : (delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'));
          const refColor = k.ref != null ? (k.invert ? 'var(--red)' : 'var(--clay)') : null;
          return (
            <div className="kpi" key={k.key}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">
                {last ? k.format(last.value) : '—'}
              </div>
              <div className="kpi-foot">
                <span className={"delta " + deltaClass}>
                  {delta != null ? fmt.ppSigned(delta, 1) + ' QoQ' : '—'}
                </span>
                <span style={{ color: 'var(--ink-faint)' }}>·</span>
                <span>{k.sub}</span>
              </div>
              <div className="kpi-spark">
                <Sparkline data={k.data.slice(-12)} width={300} height={28} color="var(--navy)" refLine={k.ref} refColor={refColor} fullWidth={true} />
              </div>
            </div>
          );
        })}
      </div>

      {/* —— Briefing + trajectory —— */}
      <div className="col-2" style={{ marginTop: 32 }}>
        <div>
          <QuarterlyBriefing asOf={asOf} onPickBank={onPickBank} />
        </div>

        <div>
          <div className="section-head">
            <h2>System trajectory</h2>
            <div className="section-meta">12 quarters</div>
          </div>

          <div className="card-bare" style={{ paddingTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div className="kpi-label">Capital Adequacy</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>
                  {fmt.pct(carData[carData.length - 1].value, 1)}
                </div>
              </div>
              <div className="legend">
                <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--navy)' }}></span>System</div>
                <div className="legend-item"><span className="legend-swatch dash"></span>BRH floor {fmt.pct(T.car_min, 0)}</div>
              </div>
            </div>
            <LineChart
              series={[{ name: 'System CAR', color: 'var(--navy)', data: carData.slice(-12), dots: true, fill: true }]}
              refs={[{ value: T.car_min, label: `BRH ≥ ${fmt.pct(T.car_min, 0)}`, color: 'var(--clay)' }]}
              width={520} height={170}
              yFormat={v => fmt.pct(v, 0)}
              yMinHint={T.car_min - 0.02}
            />
          </div>

          <div className="card-bare" style={{ paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div className="kpi-label">NPL Ratio</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>
                  {fmt.pct(nplData[nplData.length - 1].value, 1)}
                </div>
              </div>
              <div className="legend">
                <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--clay)' }}></span>System</div>
                <div className="legend-item"><span className="legend-swatch dash"></span>FSI watch {fmt.pct(T.npl_watch, 0)}</div>
              </div>
            </div>
            <LineChart
              series={[{ name: 'System NPL', color: 'var(--clay)', data: nplData.slice(-12), dots: true, fill: true }]}
              refs={[{ value: T.npl_watch, label: `Watch ≥ ${fmt.pct(T.npl_watch, 0)}`, color: 'var(--ochre)' }]}
              width={520} height={170}
              yFormat={v => fmt.pct(v, 0)}
            />
          </div>
        </div>
      </div>

      {/* —— Threshold provenance footnote (anchors the ref-lines above) —— */}
      <div style={{ marginTop: 36 }} className="threshold-block">
        <b>Reference lines.</b> CAR floor {fmt.pct(T.car_min, 0)} — <i>BRH Circulaire 88</i>; NPL watch {fmt.pct(T.npl_watch, 0)} and elevated {fmt.pct(T.npl_breach, 0)} — <i>IMF FSI</i>; Liquidity/Deposits ≥ {fmt.pct(T.liquidity_to_deposits_min, 0)} — <i>BRH</i>. Full threshold table in the Methodology tab; adjustable via the Thresholds panel.
      </div>
    </div>
  );
}

window.SystemMonitor = SystemMonitor;
