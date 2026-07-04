// Credit Dynamics — three small-multiple grids stacked:
// (1) YoY gross loan growth per bank, (2) Loans/Assets per bank, (3) Share of system loans drift per bank
// Plus nominal/real gourdes toggle for (1).

function CreditDynamics({ asOf, onPickBank }) {
  const [realMode, setRealMode] = React.useState(localStorage.getItem('haiti_real_mode') === 'on');
  const [cpiOverride, setCpiOverride] = React.useState(null);
  const [showCpiEditor, setShowCpiEditor] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem('haiti_real_mode', realMode ? 'on' : 'off');
  }, [realMode]);

  const banks = window.activeBanksAt(asOf);
  const allDates = window.indicatorDates('gross_loans');
  const recentDates = allDates.slice(-12);

  // —— Compute YoY growth series for each bank ——
  function yoyGrowthSeries(bank, real) {
    const s = window.bankSeries('gross_loans', bank);
    const out = [];
    for (let i = 4; i < s.length; i++) {
      const cur = s[i].value;
      const prev = s[i - 4].value;
      if (prev != null && prev > 0 && cur != null) {
        const nom = (cur - prev) / prev;
        if (real) {
          const cpi = (cpiOverride && cpiOverride[s[i].date] != null) ? cpiOverride[s[i].date] : window.CPI_YOY[s[i].date];
          if (cpi == null) continue;
          out.push({ date: s[i].date, value: (1 + nom) / (1 + cpi) - 1 });
        } else {
          out.push({ date: s[i].date, value: nom });
        }
      }
    }
    return out;
  }

  function loansToAssetsSeries(bank) {
    const loans = window.bankSeries('gross_loans', bank);
    const assets = window.bankSeries('total_assets', bank);
    const aMap = new Map(assets.map(p => [p.date, p.value]));
    return loans.map(p => {
      const a = aMap.get(p.date);
      return (a != null && a > 0) ? { date: p.date, value: p.value / a } : null;
    }).filter(Boolean);
  }

  function shareSeries(bank) {
    return window.bankSeries('share_of_system_assets', bank);
  }

  // —— Cell renderer ——
  function SMCellMulti({ bank, series, format, refLine, refColor, color, hint, dataKey }) {
    const last = series && series.length ? series[series.length - 1] : null;
    const prev = series && series.length > 1 ? series[series.length - 2] : null;
    const delta = (last && prev && last.value != null && prev.value != null) ? (last.value - prev.value) : null;
    return (
      <div className="sm-cell">
        <div className="sm-head">
          <button className="sm-name" onClick={() => onPickBank(bank)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{bank}</button>
          <div className="sm-val">{last && last.value != null ? format(last.value) : '—'}</div>
        </div>
        <Sparkline data={series} width={188} height={42} color={color} refLine={refLine} refColor={refColor} fill={true} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {series && series.length ? fmt.qtrShort(series[0].date) + '–' + fmt.qtrShort(series[series.length - 1].date) : '—'}
          </span>
          {delta != null && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--clay-deep)' : 'var(--ink-soft)' }}>
              {fmt.ppSigned(delta, 1)} QoQ
            </span>
          )}
        </div>
      </div>
    );
  }

  // Compute system aggregate YoY for reference band
  const sysYoY = yoyGrowthSeries(SYSTEM_KEY, realMode);
  const sysLatestYoY = sysYoY.length ? sysYoY[sysYoY.length - 1].value : null;

  return (
    <div>
      <div className="lede" style={{ marginBottom: 16 }}>
        Three lenses on private-credit dynamics. Use them together: <strong>YoY loan growth</strong> tells you who is expanding vs. retreating; <strong>loans / assets</strong> reveals balance-sheet posture (cash-rich vs. lending); <strong>share-of-system drift</strong> shows the competitive map.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label className="f">Display
            <div className="segmented">
              <button className={!realMode ? 'on' : ''} onClick={() => setRealMode(false)}>Nominal</button>
              <button className={realMode ? 'on' : ''} onClick={() => setRealMode(true)}>Real (CPI-adj.)</button>
            </div>
          </label>
          {realMode && (
            <button className="bank-chip" onClick={() => setShowCpiEditor(s => !s)}>
              {showCpiEditor ? '× CPI editor' : '✎ CPI series'}
            </button>
          )}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          System YoY {sysLatestYoY != null ? fmt.pctSigned(sysLatestYoY, 1) : '—'} · {fmt.qtr(asOf)}
        </div>
      </div>

      {showCpiEditor && (
        <CpiEditor cpiOverride={cpiOverride} setCpiOverride={setCpiOverride} />
      )}

      {realMode && (
        <div className="threshold-block" style={{ marginBottom: 16 }}>
          <b>Real growth — CPI-deflated.</b> Nominal YoY loan growth deflated by Haiti's headline consumer price index (IHSI <i>IPC</i>, base 2017–18 = 100, obtained via the IMF): <i>(1 + nominal) / (1 + CPI&nbsp;YoY) − 1</i>. Open the CPI editor to run an alternative-inflation scenario.
        </div>
      )}

      {/* —— Grid 1: YoY loan growth —— */}
      <div className="section-head" style={{ marginTop: 22 }}>
        <h2>YoY gross loan growth {realMode && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}> · Real, CPI-adj.</span>}</h2>
        <div className="section-meta">{fmt.qtrShort(recentDates[0])} – {fmt.qtrShort(recentDates[recentDates.length - 1])}</div>
      </div>
      <div className="smg cols-3">
        {banks.map(b => {
          const s = yoyGrowthSeries(b, realMode).slice(-12);
          return <SMCellMulti
            key={b} bank={b} series={s}
            format={v => fmt.pctSigned(v, 1)}
            color={s.length && s[s.length-1].value < 0 ? 'var(--clay)' : 'var(--navy)'}
            refLine={0}
            refColor={'var(--ink-soft)'}
          />;
        })}
      </div>

      {/* —— Grid 2: Loans / Assets —— */}
      <div className="section-head" style={{ marginTop: 30 }}>
        <h2>Loans / Total Assets</h2>
        <div className="section-meta">Balance-sheet posture</div>
      </div>
      <div className="smg cols-3">
        {banks.map(b => {
          const s = loansToAssetsSeries(b).slice(-12);
          return <SMCellMulti
            key={b} bank={b} series={s}
            format={v => fmt.pct(v, 0)}
            color={'var(--navy)'}
          />;
        })}
      </div>

      {/* —— Grid 3: Share of system —— */}
      <div className="section-head" style={{ marginTop: 30 }}>
        <h2>Share of system assets — drift</h2>
        <div className="section-meta">Competitive position</div>
      </div>
      <div className="smg cols-3">
        {banks.map(b => {
          const s = shareSeries(b).slice(-16);
          return <SMCellMulti
            key={b} bank={b} series={s}
            format={v => fmt.pct(v, 1)}
            color={'var(--clay-deep)'}
          />;
        })}
      </div>

      {/* —— Footnote —— */}
      <div className="threshold-block" style={{ marginTop: 32 }}>
        <b>Reading the panels.</b> A bank "pulling back" shows red YoY growth in panel 1 and a falling Loans/Assets in panel 2. A bank "re-igniting" shows positive YoY growth and rising Loans/Assets. Share-drift in panel 3 is the consequence in competitive terms — watch for sustained 50+ basis-point moves over a year.
        <div className="meta">Source: BRH quarterly. YoY = same quarter last year. {realMode ? 'CPI: IHSI IPC (base 2017–18 = 100), via IMF.' : ''}</div>
      </div>
    </div>
  );
}

// —— CPI editor ——
function CpiEditor({ cpiOverride, setCpiOverride }) {
  const dates = Object.keys(window.CPI_YOY).sort().slice(-12);
  const [local, setLocal] = React.useState(() => {
    const o = {};
    dates.forEach(d => o[d] = (cpiOverride && cpiOverride[d] != null) ? cpiOverride[d] : window.CPI_YOY[d]);
    return o;
  });
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-head" style={{ border: 'none', paddingBottom: 0, marginBottom: 6 }}>
        <h2 style={{ fontSize: 14 }}>CPI YoY series (override)</h2>
        <div className="section-meta">Edit values, then apply</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {dates.map(d => (
          <label key={d} className="f" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
            {fmt.qtrShort(d)}
            <input className="imf" type="number" step="0.001" value={local[d]} style={{ width: '100%' }}
              onChange={e => setLocal({ ...local, [d]: parseFloat(e.target.value) })} />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="bank-chip on" onClick={() => setCpiOverride({ ...local })}>Apply</button>
        <button className="bank-chip" onClick={() => setCpiOverride(null)}>Reset to actual CPI</button>
      </div>
    </div>
  );
}

window.CreditDynamics = CreditDynamics;
