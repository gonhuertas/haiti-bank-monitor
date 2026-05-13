// Bank Deep Dive — selector + one-pager per bank.

function BankDeepDive({ asOf, selected, setSelected }) {
  const T = window.BRH_THRESHOLDS;
  const banks = window.activeBanksAt(asOf);
  if (!selected || !banks.includes(selected)) {
    // pick first
    if (banks.length) setSelected(banks[0]);
    return <div className="note">Select a bank above.</div>;
  }

  const b = selected;

  // Indicators to show
  const indicators = [
    { id: 'car', label: 'Capital Adequacy Ratio', fmt: v => fmt.pct(v, 1), refKey: 'car_min', refLabel: 'BRH ≥ 12%' },
    { id: 'capital_to_assets', label: 'Capital / Assets', fmt: v => fmt.pct(v, 1), refKey: 'capital_to_assets_min', refLabel: 'Floor 5%' },
    { id: 'npl_ratio', label: 'NPL Ratio', fmt: v => fmt.pct(v, 1), refKey: 'npl_watch', refLabel: 'Watch 5%' },
    { id: 'provision_coverage', label: 'Provision Coverage', fmt: v => fmt.mult(v, 2), refKey: 'provision_coverage_min', refLabel: 'BRH ≥ 1.00×' },
    { id: 'net_npl_to_equity', label: 'Net NPLs / Equity', fmt: v => fmt.pct(v, 1), refKey: 'net_npl_to_equity_watch', refLabel: 'Watch 25%' },
    { id: 'liquidity_to_deposits', label: 'Liquidity / Deposits', fmt: v => fmt.pct(v, 0), refKey: 'liquidity_to_deposits_min', refLabel: 'BRH ≥ 30%' },
    { id: 'roa', label: 'ROA (cum. FY)', fmt: v => fmt.pct(v, 2), refKey: null },
    { id: 'roe', label: 'ROE (cum. FY)', fmt: v => fmt.pct(v, 1), refKey: null }
  ];

  const sizeIndicators = [
    { id: 'total_assets', label: 'Total Assets', unit: 'HTG bn' },
    { id: 'gross_loans', label: 'Gross Loans', unit: 'HTG bn' },
    { id: 'total_deposits', label: 'Total Deposits', unit: 'HTG bn' },
    { id: 'shareholder_equity', label: 'Shareholder Equity', unit: 'HTG bn' },
    { id: 'regulatory_capital', label: 'Regulatory Capital', unit: 'HTG bn' },
    { id: 'rwa', label: 'Risk-Weighted Assets', unit: 'HTG bn' }
  ];

  // Active flags this bank
  const bankFlags = [];
  for (const ind of indicators) {
    const v = window.atDate(ind.id, b, asOf);
    if (v == null) continue;
    const ev = window.evaluate(ind.id, v, T);
    if (ev.status === 'breach' || ev.status === 'watch') {
      bankFlags.push({ ind, v, ev });
    }
  }

  const totalAssets = window.atDate('total_assets', b, asOf);
  const shareAssets = window.atDate('share_of_system_assets', b, asOf);

  return (
    <div>
      <div className="lede" style={{ marginBottom: 12 }}>
        Per-bank file: prudential ratios with thresholds, size & growth indicators, current quarter flags.
      </div>

      {/* Bank picker */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        <label className="f" style={{ marginRight: 8 }}>Select bank</label>
        {banks.map(bn => (
          <button key={bn} className={"bank-chip " + (bn === b ? 'on' : '')} onClick={() => setSelected(bn)}>{bn}</button>
        ))}
      </div>

      {/* Bank header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: 24, padding: '8px 0 18px', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--rule)' }}>
        <div>
          <div className="eyebrow">Bank Code · {b}</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: '4px 0 0', color: 'var(--ink)' }}>
            {BANK_LONG[b] || b}
          </h1>
          <div style={{ color: 'var(--ink-soft)', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, marginTop: 4 }}>
            Quarterly file · as of {fmt.qtr(asOf)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="kpi-label">Total assets</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {totalAssets != null ? fmt.htg(totalAssets, 1) : '—'} <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>HTG bn</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kpi-label">System share</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>
              {shareAssets != null ? fmt.pct(shareAssets, 1) : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kpi-label">Active flags</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: bankFlags.length === 0 ? 'var(--green)' : bankFlags.some(f => f.ev.status === 'breach') ? 'var(--red)' : 'var(--ochre)' }}>
              {bankFlags.length}
            </div>
          </div>
        </div>
      </div>

      {/* Flags banner */}
      {bankFlags.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, padding: '10px 0', borderBottom: '1px solid var(--rule)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginRight: 4, alignSelf: 'center' }}>Active flags:</span>
          {bankFlags.map((f, i) => (
            <span key={i} className={"pill " + (f.ev.status === 'breach' ? 'breach' : 'watch')}>
              {f.ind.label} · {f.ind.fmt(f.v)}
            </span>
          ))}
        </div>
      )}

      {/* Indicator small multiples */}
      <div className="section-head" style={{ marginTop: 28 }}>
        <h2>Prudential indicators · trend</h2>
        <div className="section-meta">Last 12 quarters</div>
      </div>
      <div className="smg cols-4">
        {indicators.map(ind => {
          const series = window.bankSeries(ind.id, b).slice(-12);
          if (!series.length) return (
            <div className="sm-cell" key={ind.id}>
              <div className="sm-head"><span className="sm-name">{ind.label}</span><span className="sm-val">—</span></div>
              <div style={{ height: 42 }}></div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginTop: 4 }}>No data</div>
            </div>
          );
          const last = series[series.length - 1];
          const ev = window.evaluate(ind.id, last.value, T);
          const ref = ind.refKey ? T[ind.refKey] : null;
          const color = ev.status === 'breach' ? 'var(--red)' : ev.status === 'watch' ? 'var(--ochre)' : 'var(--navy)';
          return (
            <div className="sm-cell" key={ind.id}>
              <div className="sm-head">
                <span className="sm-name">{ind.label}</span>
                <span className="sm-val" style={{ color }}>{ind.fmt(last.value)}</span>
              </div>
              <Sparkline data={series} width={188} height={42} color={color} refLine={ref} refColor="var(--clay)" fill={true} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {ind.refLabel || ' '}
                </span>
                <span className={"pill " + (ev.status === 'breach' ? 'breach' : ev.status === 'watch' ? 'watch' : ev.status === 'ok' ? 'ok' : '')} style={{ fontSize: 9 }}>
                  {ev.status === 'na' ? '—' : ev.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Size table */}
      <div className="section-head" style={{ marginTop: 30 }}>
        <h2>Balance sheet · size & growth</h2>
        <div className="section-meta">HTG bn unless noted</div>
      </div>
      <table className="dt">
        <thead>
          <tr>
            <th>Line item</th>
            {window.indicatorDates('total_assets').slice(-4).map(d => (
              <th key={d}>{fmt.qtrShort(d)}</th>
            ))}
            <th>QoQ</th>
            <th>YoY</th>
          </tr>
        </thead>
        <tbody>
          {sizeIndicators.map(si => {
            const all = window.bankSeries(si.id, b);
            const last4 = all.slice(-4);
            const qoq = all.length >= 2 ? (all[all.length-1].value / all[all.length-2].value - 1) : null;
            const yoy = all.length >= 5 ? (all[all.length-1].value / all[all.length-5].value - 1) : null;
            return (
              <tr key={si.id}>
                <td className="bank-name" style={{ textAlign: 'left' }}>{si.label}</td>
                {window.indicatorDates('total_assets').slice(-4).map(d => {
                  const v = window.atDate(si.id, b, d);
                  return <td key={d} className="num"><span className="mono">{v != null ? fmt.htg(v, 1) : '—'}</span></td>;
                })}
                <td className="num"><span className="mono" style={{ color: qoq == null ? 'var(--ink-soft)' : qoq < 0 ? 'var(--clay-deep)' : 'var(--green)' }}>{qoq != null ? fmt.pctSigned(qoq, 1) : '—'}</span></td>
                <td className="num"><span className="mono" style={{ color: yoy == null ? 'var(--ink-soft)' : yoy < 0 ? 'var(--clay-deep)' : 'var(--green)' }}>{yoy != null ? fmt.pctSigned(yoy, 1) : '—'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Peer comparison strip */}
      <div className="section-head" style={{ marginTop: 30 }}>
        <h2>Peer position · {fmt.qtr(asOf)}</h2>
        <div className="section-meta">Where {b} sits among the {banks.length} active banks</div>
      </div>
      <div className="col-3">
        {['car', 'npl_ratio', 'liquidity_to_deposits'].map(indId => {
          const rows = banks.map(bk => {
            const v = window.atDate(indId, bk, asOf);
            return v != null ? { bank: bk, value: v } : null;
          }).filter(Boolean);
          const invert = indId === 'npl_ratio';
          rows.sort((a,b) => invert ? a.value - b.value : b.value - a.value);
          const rank = rows.findIndex(r => r.bank === b) + 1;
          const label = indId === 'car' ? 'Capital Adequacy' : indId === 'npl_ratio' ? 'NPL Ratio' : 'Liquidity / Deposits';
          const myVal = window.atDate(indId, b, asOf);
          const formatter = indId === 'car' || indId === 'liquidity_to_deposits' ? v => fmt.pct(v, 1) : v => fmt.pct(v, 1);
          return (
            <div className="card" key={indId}>
              <div className="kpi-label">{label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>{myVal != null ? formatter(myVal) : '—'}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)' }}>
                  rank <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{rank}</b> / {rows.length}
                </div>
              </div>
              <PeerStrip rows={rows} highlight={b} format={formatter} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeerStrip({ rows, highlight, format }) {
  const W = 280, H = 34;
  const pad = 6;
  const vals = rows.map(r => r.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.05; max += span * 0.05;
  const x = window.linearScale([min, max], [pad, W - pad]);
  return (
    <svg className="chart" width={W} height={H} style={{ marginTop: 8 }}>
      <line x1={pad} x2={W - pad} y1={H/2} y2={H/2} stroke="var(--rule)" />
      {rows.map((r, i) => {
        const isMe = r.bank === highlight;
        return (
          <g key={r.bank}>
            <circle cx={x(r.value)} cy={H/2} r={isMe ? 5 : 3} fill={isMe ? 'var(--clay)' : 'var(--ink-mid)'} fillOpacity={isMe ? 1 : 0.5} stroke={isMe ? 'var(--clay-deep)' : 'none'} />
            {isMe && (
              <text x={x(r.value)} y={H/2 - 9} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--clay-deep)' }}>{r.bank}</text>
            )}
          </g>
        );
      })}
      <text x={pad} y={H - 2} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-soft)' }}>{format(min)}</text>
      <text x={W - pad} y={H - 2} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-soft)' }}>{format(max)}</text>
    </svg>
  );
}

window.BankDeepDive = BankDeepDive;
