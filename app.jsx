// Main app — shell, header, tab routing, threshold tweaks panel.

const { useState, useEffect, useMemo } = React;

function App() {
  const allDatesArr = window.allDates();
  const defaultDate = allDatesArr[allDatesArr.length - 1]; // latest

  const [tab, setTab] = useState(() => localStorage.getItem('haiti_tab') || 'monitor');
  const [asOf, setAsOf] = useState(defaultDate);
  const [selectedBank, setSelectedBank] = useState('UNIBK');
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [thresholds, setThresholds] = useState(window.BRH_THRESHOLDS);

  useEffect(() => { localStorage.setItem('haiti_tab', tab); }, [tab]);

  // Sync thresholds into window so other modules see the change
  useEffect(() => { window.BRH_THRESHOLDS = thresholds; }, [thresholds]);

  function onPickBank(b) {
    setSelectedBank(b);
    setTab('bank');
  }

  // Last 16 quarter date options for the as-of selector
  const dateOptions = allDatesArr.slice(-20);

  const tabs = [
    { id: 'monitor',   label: 'System Monitor',  num: '01' },
    { id: 'quality',   label: 'Asset Quality',   num: '02' },
    { id: 'credit',    label: 'Credit Dynamics', num: '03' },
    { id: 'fx',        label: 'FX Open Positions', num: '04' },
    { id: 'bank',      label: 'Bank Deep Dive',  num: '05' },
    { id: 'method',    label: 'Methodology',     num: '06' }
  ];

  return (
    <div className="app">
      {/* —— Masthead —— */}
      <div className="masthead">
        <div className="masthead-l">
          <div className="eyebrow">Banque de la République d'Haïti · Supervisory analytics</div>
          <h1>Haiti <em>Banking System Monitor</em></h1>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 }}>
            Quarterly prudential indicators for the {window.activeBanksAt(defaultDate).length}-bank commercial system
          </div>
        </div>
        <div className="masthead-r">
          <div className="masthead-meta">
            <div>As of</div>
            <b>
              <select className="imf" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ marginTop: 4 }}>
                {dateOptions.slice().reverse().map(d => (
                  <option key={d} value={d}>{fmt.qtr(d)}</option>
                ))}
              </select>
            </b>
          </div>
          <div className="crest">H</div>
        </div>
      </div>

      {/* —— Tab bar —— */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={"tab " + (tab === t.id ? 'active' : '')} onClick={() => setTab(t.id)}>
            <span className="tab-num">{t.num}</span>
            <span>{t.label}</span>
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 4 }}>
          <button className="bank-chip" onClick={() => setTweaksOpen(true)} style={{ border: '1px solid var(--ink)' }}>
            ⚙ Thresholds
          </button>
        </div>
      </div>

      {/* —— Active tab —— */}
      {tab === 'monitor' && <SystemMonitor asOf={asOf} onPickBank={onPickBank} onNavTab={setTab} />}
      {tab === 'quality' && <AssetQuality asOf={asOf} onPickBank={onPickBank} />}
      {tab === 'credit'  && <CreditDynamics asOf={asOf} onPickBank={onPickBank} />}
      {tab === 'fx'      && <FxOpenPositions asOf={asOf} onPickBank={onPickBank} />}
      {tab === 'bank'    && <BankDeepDive asOf={asOf} selected={selectedBank} setSelected={setSelectedBank} />}
      {tab === 'method'  && <Methodology />}

      {/* —— Footer —— */}
      <div className="footer-rule">
        <span>Source · BRH Indicateurs Financiers · {dateOptions.length} quarters loaded</span>
        <span>Build · {new Date().toISOString().slice(0, 10)} · v0.1</span>
      </div>

      {/* —— Threshold tweaks panel —— */}
      {tweaksOpen && <ThresholdPanel thresholds={thresholds} setThresholds={setThresholds} onClose={() => setTweaksOpen(false)} />}
    </div>
  );
}

function ThresholdPanel({ thresholds, setThresholds, onClose }) {
  const groups = [
    { title: 'Capital', items: [
      { k: 'car_min', label: 'CAR · BRH minimum', unit: '%' },
      { k: 'car_watch', label: 'CAR · watch buffer', unit: '%' },
      { k: 'capital_to_assets_min', label: 'Capital/Assets · leverage floor', unit: '%' },
      { k: 'capital_to_assets_watch', label: 'Capital/Assets · watch', unit: '%' }
    ]},
    { title: 'Liquidity', items: [
      { k: 'liquidity_to_deposits_min', label: 'Liquidity/Deposits · BRH min', unit: '%' },
      { k: 'liquidity_to_deposits_watch', label: 'Liquidity/Deposits · watch', unit: '%' },
      { k: 'liquidity_to_assets_watch', label: 'Liquidity/Assets · watch', unit: '%' }
    ]},
    { title: 'Asset quality', items: [
      { k: 'npl_watch', label: 'NPL · watch ceiling', unit: '%' },
      { k: 'npl_breach', label: 'NPL · elevated ceiling', unit: '%' },
      { k: 'provision_coverage_min', label: 'Provision coverage · BRH min', unit: '×' },
      { k: 'provision_coverage_watch', label: 'Provision coverage · watch', unit: '×' },
      { k: 'net_npl_to_equity_watch', label: 'Net NPL/Equity · watch', unit: '%' },
      { k: 'net_npl_to_equity_breach', label: 'Net NPL/Equity · elevated', unit: '%' }
    ]},
    { title: 'FX', items: [
      { k: 'fx_open_position_limit', label: 'Net structural FX position · Circulaire 81-6 (% of equity)', unit: '±%' }
    ]}
  ];

  function update(k, v) {
    setThresholds({ ...thresholds, [k]: v });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(19, 27, 42, 0.40)', zIndex: 4000, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 420, height: '100%', background: 'var(--paper)', borderLeft: '1px solid var(--ink)', overflowY: 'auto', padding: '20px 24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--ink)', paddingBottom: 10, marginBottom: 16 }}>
          <div>
            <div className="eyebrow">Calibration</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, margin: '2px 0 0' }}>Thresholds</h2>
          </div>
          <button className="bank-chip" onClick={onClose}>× Close</button>
        </div>

        <div className="note" style={{ marginBottom: 16 }}>
          Adjustments propagate to every flag in every tab. All values are stored locally.
        </div>

        {groups.map(g => (
          <div key={g.title} style={{ marginBottom: 22 }}>
            <h3 style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--clay-deep)', marginBottom: 8, borderBottom: '1px solid var(--rule)', paddingBottom: 4 }}>{g.title}</h3>
            {g.items.map(it => (
              <div key={it.k} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '6px 0' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink)' }}>{it.label}</div>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-soft)', letterSpacing: '0.04em' }}>{window.THRESHOLD_PROVENANCE[it.k] ? window.THRESHOLD_PROVENANCE[it.k].source : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input className="imf" type="number" step="0.005" value={thresholds[it.k]} style={{ width: 86, textAlign: 'right' }}
                    onChange={e => update(it.k, parseFloat(e.target.value))} />
                  <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', minWidth: 18 }}>{it.unit === '×' ? '×' : '×100'}</span>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="threshold-block">
          <b>Reset.</b>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="bank-chip" onClick={() => setThresholds({
              car_min: 0.12, car_watch: 0.14,
              capital_to_assets_min: 0.05, capital_to_assets_watch: 0.06,
              liquidity_to_deposits_min: 0.30, liquidity_to_deposits_watch: 0.35,
              liquidity_to_assets_watch: 0.20,
              npl_watch: 0.05, npl_breach: 0.10,
              provision_coverage_min: 1.00, provision_coverage_watch: 1.20,
              net_npl_to_equity_watch: 0.25, net_npl_to_equity_breach: 0.50,
              fx_open_position_limit: 0.20
            })}>↺ Restore defaults</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bootstrap: fetch core bank data (required) plus FX positions and CPI
// (both optional) in parallel, then render. data.json failure aborts; the
// other two failing only degrades the relevant tabs.
Promise.all([
  fetch('data.json').then(r => r.ok ? r.json() : Promise.reject('data.json HTTP ' + r.status)),
  fetch('fx_data.json').then(r => r.ok ? r.json() : null).catch(() => null),
  fetch('cpi_data.json').then(r => r.ok ? r.json() : null).catch(() => null),
])
  .then(([bankData, fxData, cpiData]) => {
    window.__BANK_DATA = bankData;
    window.__FX_DATA   = fxData;   // null if missing/unreadable
    window.__CPI_DATA  = cpiData;  // null if missing/unreadable

    // Build window.CPI_YOY: a quarter-end-keyed map of YoY inflation, used by
    // realYoY / realRate / Credit Dynamics' real-vs-nominal toggle. Stays as
    // an empty map if cpi_data.json is missing — every consumer is null-safe.
    window.CPI_YOY = {};
    if (cpiData && Array.isArray(cpiData.quarterly)) {
      cpiData.quarterly.forEach(r => {
        if (r.inflation_yoy != null) window.CPI_YOY[r.date] = r.inflation_yoy;
      });
    }
    // Backward-compat alias for any code still referencing the old name.
    window.SAMPLE_CPI_YOY = window.CPI_YOY;

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  })
  .catch(e => {
    document.getElementById('root').innerHTML =
      '<div style="padding:48px;font-family:IBM Plex Mono,monospace;color:#A93826">Failed to load data.json: ' + e.message + '</div>';
  });
