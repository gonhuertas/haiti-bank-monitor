// FX Open Positions tab — live BRH posinette data, Circulaire 86 monitoring.
// Data is loaded by app.jsx into window.__FX_DATA and built by
// build_fx_data.py from FM Test/brh-dashboard/data/processed/brh_fx_positions.csv.

function FxOpenPositions({ asOf, onPickBank }) {
  const T = window.BRH_THRESHOLDS;
  const fx = window.__FX_DATA;

  if (!fx) {
    return (
      <div>
        <div className="section-head">
          <h2>FX Open Positions</h2>
          <div className="section-meta" style={{ color: 'var(--red)' }}>fx_data.json unavailable</div>
        </div>
        <div className="threshold-block" style={{ background: 'var(--card)', borderLeft: '3px solid var(--red)' }}>
          <b>FX data not loaded.</b> The dashboard expects <code className="mono">fx_data.json</code> alongside <code className="mono">data.json</code>.
          Generate it by running <code className="mono">python build_fx_data.py</code> from the repo root after refreshing the upstream BRH pipeline.
        </div>
      </div>
    );
  }

  const limit = fx.limit;
  const dates = fx.dates;
  const banks = fx.banks;

  // Latest snapshot
  const latestRows = banks.map(b => {
    const pos = fx.data[b].positions.find(p => p.date === asOf);
    const days = fx.data[b].breachDays.find(p => p.date === asOf);
    return {
      bank: b,
      position: pos ? pos.value : null,
      days: days ? days.value : 0,
    };
  });

  // Status per latest
  function statusOf(pos, days) {
    if (pos == null) return 'na';
    if (Math.abs(pos) > limit || days > 5) return 'breach';
    if (Math.abs(pos) > limit * 0.85 || days > 0) return 'watch';
    return 'ok';
  }

  const sorted = [...latestRows].sort((a, b) => Math.abs(b.position || 0) - Math.abs(a.position || 0));

  return (
    <div>
      <div className="lede" style={{ marginBottom: 18 }}>
        Net open FX position per bank, measured against the <strong>BRH Circulaire 86 limit</strong> of {fmt.pct(limit, 0)} of regulatory capital. Includes intra-quarter breach-days where the limit was exceeded on individual reporting days even when the quarter-end print was inside the band.
      </div>

      {/* —— KPI row —— */}
      <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {(() => {
          const inBreach = sorted.filter(r => statusOf(r.position, r.days) === 'breach').length;
          const onWatch  = sorted.filter(r => statusOf(r.position, r.days) === 'watch').length;
          const longest = Math.max(...latestRows.map(r => Math.abs(r.position || 0)));
          const totalDays = latestRows.reduce((a, r) => a + (r.days || 0), 0);
          return [
            { label: 'Regulatory limit', val: '±' + fmt.pct(limit, 0), sub: 'BRH Circulaire 86', cls: '' },
            { label: 'Banks in breach · ' + fmt.qtr(asOf), val: inBreach + '', sub: 'quarter-end print over limit', cls: inBreach > 0 ? 'breach' : 'ok' },
            { label: 'Banks on watch', val: onWatch + '', sub: '≥85% of limit or intra-qtr breach', cls: onWatch > 0 ? 'watch' : 'ok' },
            { label: 'Aggregate breach-days', val: totalDays + '', sub: 'sum across banks this quarter', cls: totalDays > 30 ? 'watch' : 'ok' }
          ].map((k, i) => (
            <div className="kpi" key={i}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.val}</div>
              <div className="kpi-foot"><span>{k.sub}</span></div>
            </div>
          ));
        })()}
      </div>

      <div className="col-2" style={{ marginTop: 32 }}>
        {/* —— Latest positions: butterfly bar chart around 0 —— */}
        <div>
          <div className="section-head">
            <h2>Net open FX positions · {fmt.qtr(asOf)}</h2>
            <div className="section-meta">% of regulatory capital</div>
          </div>
          <FxButterfly rows={sorted} limit={limit} />
          <div className="note" style={{ marginTop: 6 }}>
            Positive = long FX (typically USD); negative = short FX. The dashed band shows the ±{fmt.pct(limit, 0)} regulatory corridor.
          </div>
        </div>

        {/* —— Breach-day table —— */}
        <div>
          <div className="section-head">
            <h2>Intra-quarter breach days</h2>
            <div className="section-meta">Last 4 quarters</div>
          </div>
          <table className="dt">
            <thead>
              <tr>
                <th>Bank</th>
                {dates.slice(-4).map(d => <th key={d}>{fmt.qtrShort(d)}</th>)}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const status = statusOf(r.position, r.days);
                return (
                  <tr key={r.bank}>
                    <td className="bank-name" style={{ textAlign: 'left' }}>
                      <button className="bn" onClick={() => onPickBank(r.bank)}>{r.bank}</button>
                    </td>
                    {dates.slice(-4).map(d => {
                      const days = fx.data[r.bank].breachDays.find(p => p.date === d);
                      const dv = days ? days.value : 0;
                      const bg = dv === 0 ? 'transparent' : dv <= 5 ? 'rgba(182, 136, 33, 0.18)' : 'rgba(169, 56, 38, 0.20)';
                      return (
                        <td key={d} className="num" style={{ background: bg, fontFamily: 'var(--mono)', fontSize: 11 }}>{dv}</td>
                      );
                    })}
                    <td>
                      <span className={"pill " + (status === 'breach' ? 'breach' : status === 'watch' ? 'watch' : status === 'ok' ? 'ok' : '')}>
                        {status === 'na' ? '—' : status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* —— Position trajectories —— */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>Position trajectory · 8 quarters</h2>
        <div className="section-meta">Each bank vs. ±{fmt.pct(limit, 0)} corridor</div>
      </div>
      <div className="smg cols-3">
        {banks.map(b => {
          const ser = fx.data[b].positions.map(p => ({ date: p.date, value: p.value }));
          const last = ser[ser.length - 1];
          return (
            <div className="sm-cell" key={b}>
              <div className="sm-head">
                <button className="sm-name" onClick={() => onPickBank(b)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{b}</button>
                <div className="sm-val">{fmt.pctSigned(last.value, 1)}</div>
              </div>
              <FxMiniLane series={ser} limit={limit} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {fmt.qtrShort(ser[0].date)}–{fmt.qtrShort(ser[ser.length - 1].date)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: Math.abs(last.value) > limit ? 'var(--red)' : Math.abs(last.value) > limit * 0.85 ? 'var(--ochre)' : 'var(--ink-soft)' }}>
                  {(Math.abs(last.value) / limit * 100).toFixed(0)}% of limit
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="threshold-block" style={{ marginTop: 32 }}>
        <b>BRH Circulaire 86 — Net Open Foreign Currency Position.</b> Commercial banks must keep their net FX position (assets minus liabilities, summed across currencies, in absolute terms) within ±{fmt.pct(limit, 0)} of regulatory capital. Daily-basis monitoring, with prudential sanctions for repeated breaches.
        <div className="meta">Adjustable in Thresholds panel. Source: BRH Circulaire 86 (placeholder citation).</div>
      </div>
    </div>
  );
}

// —— Butterfly bar (centered at 0, extending both directions) ——

function FxButterfly({ rows, limit }) {
  const width = 540;
  const margin = { top: 18, right: 70, bottom: 28, left: 78 };
  const innerW = width - margin.left - margin.right;
  const max = Math.max(0.30, ...rows.map(r => Math.abs(r.position || 0)));
  const x = window.linearScale([-max, max], [0, innerW]);
  const bandH = 22;
  const height = margin.top + margin.bottom + rows.length * bandH;
  const innerH = rows.length * bandH;

  return (
    <svg className="chart" width={width} height={height}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* limit corridor */}
        <rect x={x(-limit)} y={0} width={x(limit) - x(-limit)} height={innerH} fill="rgba(31, 58, 95, 0.05)" />
        <line x1={x(-limit)} x2={x(-limit)} y1={0} y2={innerH} className="ref-line" stroke="var(--clay)" />
        <line x1={x(limit)} x2={x(limit)} y1={0} y2={innerH} className="ref-line" stroke="var(--clay)" />
        <text x={x(limit)} y={-4} textAnchor="middle" className="ref-label" fill="var(--clay-deep)">+{fmt.pct(limit, 0)}</text>
        <text x={x(-limit)} y={-4} textAnchor="middle" className="ref-label" fill="var(--clay-deep)">−{fmt.pct(limit, 0)}</text>
        {/* zero */}
        <line x1={x(0)} x2={x(0)} y1={0} y2={innerH} stroke="var(--ink)" />
        {/* bars */}
        {rows.map((r, i) => {
          if (r.position == null) return null;
          const yPos = i * bandH;
          const over = Math.abs(r.position) > limit;
          const watch = Math.abs(r.position) > limit * 0.85;
          const color = over ? 'var(--red)' : watch ? 'var(--ochre)' : 'var(--navy)';
          const bw = Math.abs(x(r.position) - x(0));
          const bx = r.position < 0 ? x(r.position) : x(0);
          return (
            <g key={r.bank} transform={`translate(0,${yPos})`}>
              <text x="-10" y={bandH/2} dy="0.32em" textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fill: 'var(--ink)' }}>{r.bank}</text>
              <rect x={bx} y={bandH * 0.22} width={bw} height={bandH * 0.56} fill={color} />
              <text x={r.position >= 0 ? x(r.position) + 4 : x(r.position) - 4}
                    y={bandH/2} dy="0.32em"
                    textAnchor={r.position >= 0 ? 'start' : 'end'}
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' }}>
                {fmt.pctSigned(r.position, 1)}
              </text>
            </g>
          );
        })}
        {/* x ticks */}
        <g className="axis" transform={`translate(0,${innerH})`}>
          <line x1="0" x2={innerW} stroke="var(--ink)" />
          {[-max, -limit, 0, limit, max].map((t, i) => (
            <g key={i} transform={`translate(${x(t)},0)`}>
              <line y1="0" y2="3" stroke="var(--ink)" />
              <text y="14" textAnchor="middle">{fmt.pctSigned(t, 0)}</text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}

// Mini lane: shows position over time with corridor band
function FxMiniLane({ series, limit }) {
  const W = 188, H = 42, pad = 4;
  const max = Math.max(limit * 1.4, ...series.map(p => Math.abs(p.value)));
  const x = window.linearScale([0, series.length - 1], [pad, W - pad]);
  const y = window.linearScale([-max, max], [H - pad, pad]);
  const path = series.map((p, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join(' ');
  return (
    <svg className="chart" width={W} height={H} style={{ display: 'block' }}>
      <rect x={pad} y={y(limit)} width={W - 2 * pad} height={y(-limit) - y(limit)} fill="rgba(31,58,95,0.06)" />
      <line x1={pad} x2={W - pad} y1={y(limit)} y2={y(limit)} stroke="var(--clay)" strokeDasharray="3 2" />
      <line x1={pad} x2={W - pad} y1={y(-limit)} y2={y(-limit)} stroke="var(--clay)" strokeDasharray="3 2" />
      <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="var(--ink-faint)" strokeWidth="0.5" />
      <path d={path} stroke="var(--navy)" fill="none" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].value)} r="2.2" fill="var(--navy)" />
    </svg>
  );
}

window.FxOpenPositions = FxOpenPositions;
