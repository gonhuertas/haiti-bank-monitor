// Asset Quality tab — NPL heatmap (banks × quarters), provision coverage, net NPL/equity

function AssetQuality({ asOf, onPickBank }) {
  const T = window.BRH_THRESHOLDS;
  const banks = window.activeBanksAt(asOf);

  // Heatmap: NPL ratio, last 12 quarters
  const allDates = window.indicatorDates('npl_ratio');
  const hmDates = allDates.slice(-12);

  // Provision coverage latest bar chart
  const covRows = banks.map(b => {
    const v = window.atDate('provision_coverage', b, asOf);
    if (v == null) return null;
    const ev = window.evaluate('provision_coverage', v, T);
    return { label: b, value: v, status: ev.status };
  }).filter(Boolean).sort((a,b) => b.value - a.value);

  // Net NPL / Equity
  const netRows = banks.map(b => {
    const v = window.atDate('net_npl_to_equity', b, asOf);
    if (v == null) return null;
    const ev = window.evaluate('net_npl_to_equity', v, T);
    return { label: b, value: v, status: ev.status };
  }).filter(Boolean).sort((a,b) => b.value - a.value);

  // System weighted NPL series
  const sysNpl = window.bankSeries('npl_ratio', SYSTEM_KEY);

  return (
    <div>
      <div className="lede" style={{ marginBottom: 18 }}>
        Three views of asset quality. The matrix shows <strong>NPL ratio per bank, per quarter</strong> — designed for pattern-spotting across time and across the system simultaneously. Coverage and net-of-provisions exposure follow.
      </div>

      {/* NPL Heatmap */}
      <div className="section-head">
        <h2>NPL ratio — bank × quarter</h2>
        <div className="section-meta">
          <span className="legend">
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'rgb(251,246,233)', border: '1px solid var(--rule)' }}></span>&lt; {fmt.pct(T.npl_watch, 0)}</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'rgb(213,137,99)' }}></span>watch</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'rgb(138,56,35)' }}></span>&gt; {fmt.pct(T.npl_breach, 0)}</span>
          </span>
        </div>
      </div>

      <Heatmap
        banks={banks}
        dates={hmDates}
        values={(b, d) => window.atDate('npl_ratio', b, d)}
        colorScale={window.nplColor}
        format={v => fmt.pct(v, 1)}
        cellW={42}
        labelW={100}
        refValue={T.npl_watch}
      />

      <div className="note" style={{ marginTop: 10 }}>
        Hatched cells = bank not yet reporting that quarter. Click any bank name in the table below or in the Bank Deep Dive tab for the bank's complete file.
      </div>

      {/* —— Two-column: System NPL trend + bank bar —— */}
      <div className="col-2" style={{ marginTop: 32 }}>
        <div>
          <div className="section-head">
            <h2>System NPL — long view</h2>
            <div className="section-meta">{sysNpl.length} quarters</div>
          </div>
          <LineChart
            series={[{ name: 'System NPL ratio', color: 'var(--clay)', data: sysNpl.slice(-24), fill: true }]}
            refs={[
              { value: T.npl_watch, label: `Watch ${fmt.pct(T.npl_watch, 0)}`, color: 'var(--ochre)' },
              { value: T.npl_breach, label: `Elevated ${fmt.pct(T.npl_breach, 0)}`, color: 'var(--red)' }
            ]}
            width={620} height={240}
            yFormat={v => fmt.pct(v, 1)}
            xTickEvery={4}
          />
          <div className="note">Loan-weighted system NPL ratio. Source: BRH quarterly aggregates.</div>
        </div>

        <div>
          <div className="section-head">
            <h2>NPL ratio · {fmt.qtr(asOf)}</h2>
            <div className="section-meta">By bank</div>
          </div>
          {(() => {
            const rows = banks.map(b => {
              const v = window.atDate('npl_ratio', b, asOf);
              if (v == null) return null;
              const ev = window.evaluate('npl_ratio', v, T);
              return { label: b, value: v, status: ev.status };
            }).filter(Boolean).sort((a,b) => b.value - a.value);
            return (
              <BarChart
                rows={rows}
                width={520} height={Math.max(220, 28 * rows.length)}
                xFormat={v => fmt.pct(v, 0)}
                refs={[
                  { value: T.npl_watch, label: 'Watch', color: 'var(--ochre)' },
                  { value: T.npl_breach, label: 'Elevated', color: 'var(--red)' }
                ]}
              />
            );
          })()}
        </div>
      </div>

      {/* —— Coverage + Net NPL/Equity —— */}
      <div className="col-2" style={{ marginTop: 32 }}>
        <div>
          <div className="section-head">
            <h2>Provision coverage</h2>
            <div className="section-meta">Provisions / NPLs</div>
          </div>
          <BarChart
            rows={covRows}
            width={520} height={Math.max(220, 28 * covRows.length)}
            xFormat={v => v.toFixed(2) + '×'}
            refs={[
              { value: T.provision_coverage_min, label: `BRH ≥ ${T.provision_coverage_min.toFixed(2)}×`, color: 'var(--clay)' }
            ]}
            xMaxHint={2.0}
          />
          <div className="note">A coverage ratio below 1.00× implies provisions do not fully cover non-performing loans; the residual hits equity if loans are written off.</div>
        </div>

        <div>
          <div className="section-head">
            <h2>Net NPLs / Equity</h2>
            <div className="section-meta">Capital impact of unprovisioned losses</div>
          </div>
          <BarChart
            rows={netRows}
            width={520} height={Math.max(220, 28 * netRows.length)}
            xFormat={v => fmt.pct(v, 0)}
            refs={[
              { value: T.net_npl_to_equity_watch, label: 'Watch', color: 'var(--ochre)' },
              { value: T.net_npl_to_equity_breach, label: 'Elevated', color: 'var(--red)' }
            ]}
          />
          <div className="note">IMF FSI: a system-wide indicator of how much of the banking system's equity is exposed to underprovisioned bad loans.</div>
        </div>
      </div>
    </div>
  );
}

window.AssetQuality = AssetQuality;
