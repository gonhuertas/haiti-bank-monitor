// Methodology tab — indicator definitions, threshold sources, data sources

function Methodology() {
  const indDefs = [
    { id: 'capital_to_assets', label: 'Capital / Assets', cat: 'Capital', unit: '%', def: 'Shareholder equity divided by total assets. Simple leverage indicator; complements the risk-weighted CAR.' },
    { id: 'car', label: 'Capital Adequacy Ratio (CAR)', cat: 'Capital', unit: '%', def: 'Regulatory capital divided by risk-weighted assets. The primary solvency yardstick.' },
    { id: 'liquidity_to_assets', label: 'Liquidity / Assets', cat: 'Liquidity', unit: '%', def: 'Liquid assets (cash + short-dated claims) as share of total assets.' },
    { id: 'liquidity_to_deposits', label: 'Liquidity / Deposits', cat: 'Liquidity', unit: '%', def: 'Liquid assets as a fraction of total deposits — the BRH-mandated reserve metric.' },
    { id: 'total_assets', label: 'Total Assets', cat: 'Size', unit: 'HTG bn', def: 'Balance-sheet total.' },
    { id: 'net_loans', label: 'Net Loans', cat: 'Size', unit: 'HTG bn', def: 'Gross loans net of specific provisions (Portefeuille net).' },
    { id: 'gross_loans', label: 'Gross Loans', cat: 'Size', unit: 'HTG bn', def: 'Total credit portfolio before provisions (Portefeuille brut).' },
    { id: 'total_deposits', label: 'Total Deposits', cat: 'Size', unit: 'HTG bn', def: 'All customer deposits, all currencies.' },
    { id: 'shareholder_equity', label: 'Shareholder Equity', cat: 'Size', unit: 'HTG bn', def: 'Avoir des actionnaires — book equity.' },
    { id: 'regulatory_capital', label: 'Regulatory Capital', cat: 'Size', unit: 'HTG bn', def: 'Fonds propres réglementaires — Tier 1 + Tier 2.' },
    { id: 'rwa', label: 'Risk-Weighted Assets', cat: 'Size', unit: 'HTG bn', def: 'Assets weighted per BRH credit-risk schedule.' },
    { id: 'share_of_system_assets', label: 'Share of System Assets', cat: 'Share', unit: '%', def: 'A bank\'s total assets / sum across reporting banks.' },
    { id: 'share_of_loans_plus_deposits', label: 'Share of (Loans + Deposits)', cat: 'Share', unit: '%', def: 'Composite franchise-size measure.' },
    { id: 'share_of_deposits', label: 'Share of Deposits', cat: 'Share', unit: '%', def: 'A bank\'s deposits / system deposits.' },
    { id: 'npl_ratio', label: 'NPL Ratio', cat: 'Asset quality', unit: '%', def: 'Non-performing loans (90+ days past due) over gross loans.' },
    { id: 'provision_coverage', label: 'Provision Coverage', cat: 'Asset quality', unit: '×', def: 'Provisions divided by non-performing loans. Below 1.00× signals underprovisioning.' },
    { id: 'net_npl_to_equity', label: 'Net NPLs / Equity', cat: 'Asset quality', unit: '%', def: 'NPLs less provisions, expressed as a share of shareholder equity. The cleanest measure of equity at risk.' },
    { id: 'roa', label: 'Return on Assets', cat: 'Profitability', unit: '%', def: 'Net income / average assets. Cumulative over the fiscal year.' },
    { id: 'roe', label: 'Return on Equity', cat: 'Profitability', unit: '%', def: 'Net income / average equity. Cumulative over the fiscal year.' }
  ];

  const grouped = {};
  for (const d of indDefs) {
    if (!grouped[d.cat]) grouped[d.cat] = [];
    grouped[d.cat].push(d);
  }
  const order = ['Capital', 'Liquidity', 'Asset quality', 'Profitability', 'Size', 'Share'];

  const T = window.BRH_THRESHOLDS;
  const thresholdRows = [
    { ind: 'CAR', dir: '≥', val: fmt.pct(T.car_min, 0), src: 'BRH Circulaire 88' },
    { ind: 'Capital / Assets', dir: '≥', val: fmt.pct(T.capital_to_assets_min, 0), src: 'Basel III leverage / BRH' },
    { ind: 'Liquidity / Deposits', dir: '≥', val: fmt.pct(T.liquidity_to_deposits_min, 0), src: 'BRH' },
    { ind: 'NPL ratio (watch)', dir: '≤', val: fmt.pct(T.npl_watch, 0), src: 'IMF FSI' },
    { ind: 'NPL ratio (elevated)', dir: '≤', val: fmt.pct(T.npl_breach, 0), src: 'IMF FSI' },
    { ind: 'Provision coverage', dir: '≥', val: T.provision_coverage_min.toFixed(2) + '×', src: 'BRH' },
    { ind: 'Net NPL / Equity (watch)', dir: '≤', val: fmt.pct(T.net_npl_to_equity_watch, 0), src: 'IMF FSI' },
    { ind: 'Net NPL / Equity (elevated)', dir: '≤', val: fmt.pct(T.net_npl_to_equity_breach, 0), src: 'IMF FSI' },
    { ind: 'Net FX open position', dir: '±', val: fmt.pct(T.fx_open_position_limit, 0), src: 'BRH Circulaire 86' }
  ];

  return (
    <div>
      <div className="lede" style={{ marginBottom: 24 }}>
        Indicator definitions, supervisory thresholds and data lineage. Every flag in the dashboard cites the threshold it is measured against and the source of that threshold — no opaque "red dots".
      </div>

      <div className="col-2" style={{ alignItems: 'start' }}>
        <div>
          <div className="section-head">
            <h2>Supervisory thresholds in use</h2>
            <div className="section-meta">Editable in Tweaks → Thresholds</div>
          </div>
          <table className="dt">
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Dir.</th>
                <th>Threshold</th>
                <th style={{ textAlign: 'left' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {thresholdRows.map(r => (
                <tr key={r.ind}>
                  <td style={{ textAlign: 'left' }}>{r.ind}</td>
                  <td className="num"><span className="mono">{r.dir}</span></td>
                  <td className="num"><span className="mono">{r.val}</span></td>
                  <td style={{ textAlign: 'left' }}><span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{r.src}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="section-head">
            <h2>Data sources & cadence</h2>
            <div className="section-meta">Quarterly</div>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-mid)' }}>
            <p><strong>Primary.</strong> Banque de la République d'Haïti (BRH) — quarterly bank statistics, parsed from the published <em>Indicateurs Financiers du Secteur Bancaire</em> bulletins via <code className="mono">parse_brh_*.py</code>.</p>
            <p><strong>Currency.</strong> All HTG figures are nominal book values in billions of gourdes. Use the <em>Real</em> toggle in the Credit Dynamics tab to deflate by CPI YoY; the CPI series is currently a placeholder.</p>
            <p><strong>Fiscal year.</strong> Haitian fiscal year ends 30 September. ROA and ROE are cumulative within the fiscal year — Q1 = December, Q4 = September.</p>
            <p><strong>System aggregates.</strong> Two flavours are reported: the simple <em>SYSTÈME</em> column (sum/mean across banks per BRH conventions) and asset- or RWA-weighted aggregates (<em>SYSTÈME (weighted)</em>) where the bulletin provides them.</p>
            <p><strong>FX open positions.</strong> Stand-in only — wire to the BRH daily monitoring file when available.</p>
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 36 }}>
        <h2>Indicator dictionary</h2>
        <div className="section-meta">{indDefs.length} series</div>
      </div>

      {order.map(cat => (
        <div key={cat} style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, margin: '14px 0 6px', color: 'var(--navy)', letterSpacing: '-0.005em' }}>{cat}</h3>
          <table className="dt">
            <thead>
              <tr>
                <th>Indicator</th>
                <th style={{ textAlign: 'left' }}>Definition</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {(grouped[cat] || []).map(d => (
                <tr key={d.id}>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 500 }}>{d.label}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.04em' }}>{d.id}</div>
                  </td>
                  <td style={{ textAlign: 'left', fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-mid)' }}>{d.def}</td>
                  <td className="num"><span className="mono">{d.unit}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="threshold-block" style={{ marginTop: 24 }}>
        <b>Caveat.</b> The CAR floor of 12%, the 30% liquidity rule and the ±20% FX open-position limit follow widely-cited BRH supervisory practice; verify against the most recent <em>Circulaire</em> revisions before using in formal supervisory work. The Tweaks panel lets you adjust any threshold; changes propagate to every flag in this dashboard.
        <div className="meta">Built {new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>
  );
}

window.Methodology = Methodology;
