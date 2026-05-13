// data.js — loads real BRH supervisory data and exposes window.haitiData
// Called by index.html after fetching haiti-data.json.

(function () {
  function dateToQuarter(d) {
    const [y, m] = d.split('-').map(Number);
    const q = Math.ceil(m / 3);
    return { y, q, label: `${y}Q${q}`, short: `${String(y).slice(2)}Q${q}` };
  }

  function buildHaitiData(raw) {
    const dates = raw.dates.slice().sort();
    const quarters = dates.map(d => ({ date: d, ...dateToQuarter(d) }));
    const N_QUARTERS = quarters.length;

    const fx = dates.map(d => raw.fx[d]);

    // Per-bank series
    const banks = raw.banks.map(b => {
      const series = quarters.map((q, i) => {
        const get = (ind) => raw.values[ind]?.[q.date]?.[b.ticker];

        const totalAssets = get('total_assets'); // HTG billions
        const netLoans = get('net_loans');
        const grossLoans = get('gross_loans');
        const deposits = get('total_deposits');
        const equity = get('shareholder_equity');
        const regCapital = get('regulatory_capital');
        const rwa = get('rwa');

        const share = get('share_of_system_assets'); // 0..1
        const shareLD = get('share_of_loans_plus_deposits');
        const shareDep = get('share_of_deposits');

        const roa = get('roa');
        const roe = get('roe');
        const npl = get('npl_ratio');
        const provCov = get('provision_coverage');
        const netNplEq = get('net_npl_to_equity');
        const capToAssets = get('capital_to_assets');
        const car = get('car');
        const liqA = get('liquidity_to_assets');
        const liqD = get('liquidity_to_deposits');

        // To percentages where applicable
        return {
          q: i,
          date: q.date,
          quarter: q.label,
          totalAssets,         // HTG bn
          netLoans,            // HTG bn
          grossLoans,          // HTG bn
          deposits,            // HTG bn
          equity,              // HTG bn
          regCapital,          // HTG bn
          rwa,                 // HTG bn
          share:        share        != null ? share * 100        : null,  // %
          shareLD:      shareLD      != null ? shareLD * 100      : null,
          shareDep:     shareDep     != null ? shareDep * 100     : null,
          roa:          roa          != null ? roa * 100          : null,
          roe:          roe          != null ? roe * 100          : null,
          npl:          npl          != null ? npl * 100          : null,
          provCov:      provCov,                                          // already a multiple
          netNplEq:     netNplEq     != null ? netNplEq * 100     : null,
          capToAssets:  capToAssets  != null ? capToAssets * 100  : null,
          car:          car          != null ? car * 100          : null,
          liqA:         liqA         != null ? liqA * 100         : null,
          liqD:         liqD         != null ? liqD * 100         : null,
        };
      });
      return { ...b, series };
    });

    // System aggregates (weighted)
    const system = quarters.map((q, i) => {
      const sys = (ind) => raw.values[ind]?.[q.date]?.SYSTEM;
      const totalAssets = sys('total_assets');
      const grossLoans = sys('gross_loans');
      const netLoans = sys('net_loans');
      const deposits = sys('total_deposits');
      const equity = sys('shareholder_equity');
      const regCapital = sys('regulatory_capital');
      const rwa = sys('rwa');

      // System weighted from dedicated sheets if present
      const npl = raw.systemWeighted[q.date]?.npl != null ? raw.systemWeighted[q.date].npl * 100 : (sys('npl_ratio') != null ? sys('npl_ratio') * 100 : null);
      const car = raw.systemWeighted[q.date]?.car != null ? raw.systemWeighted[q.date].car * 100 : (sys('car') != null ? sys('car') * 100 : null);
      const roa = sys('roa') != null ? sys('roa') * 100 : null;
      const roe = sys('roe') != null ? sys('roe') * 100 : null;
      const liqA = sys('liquidity_to_assets') != null ? sys('liquidity_to_assets') * 100 : null;
      const capToAssets = sys('capital_to_assets') != null ? sys('capital_to_assets') * 100 : null;

      return {
        q: i,
        date: q.date,
        quarter: q.label,
        totalAssets, grossLoans, netLoans, deposits, equity, regCapital, rwa,
        npl, car, roa, roe, liqA, capToAssets,
        liqD:      sys('liquidity_to_deposits') != null ? sys('liquidity_to_deposits') * 100 : null,
        provCov:   sys('provision_coverage'),
        netNplEq:  sys('net_npl_to_equity') != null ? sys('net_npl_to_equity') * 100 : null,
      };
    });

    // Metric metadata
    const metrics = {
      share:       { label: "Share of system assets",         category: "size",        unit: "%", fmt: v => v.toFixed(2) + "%", higherBetter: null, source: "share_of_system_assets" },
      totalAssets: { label: "Total assets",                   category: "size",        unit: "HTG bn", fmt: v => fmtMoney(v), source: "total_assets" },
      netLoans:    { label: "Net loans",                      category: "size",        unit: "HTG bn", fmt: v => fmtMoney(v), source: "net_loans" },
      grossLoans:  { label: "Gross loans",                    category: "size",        unit: "HTG bn", fmt: v => fmtMoney(v), source: "gross_loans" },
      deposits:    { label: "Total deposits",                 category: "size",        unit: "HTG bn", fmt: v => fmtMoney(v), source: "total_deposits" },
      equity:      { label: "Shareholder equity",             category: "size",        unit: "HTG bn", fmt: v => fmtMoney(v), source: "shareholder_equity" },
      regCapital:  { label: "Regulatory capital",             category: "size",        unit: "HTG bn", fmt: v => fmtMoney(v), source: "regulatory_capital" },
      rwa:         { label: "Risk-weighted assets",           category: "size",        unit: "HTG bn", fmt: v => fmtMoney(v), source: "rwa" },
      roa:         { label: "ROA",                            category: "profitability", unit: "%", fmt: v => v.toFixed(2) + "%", higherBetter: true, source: "roa", note: "Cumulative fiscal year — resets each January" },
      roe:         { label: "ROE",                            category: "profitability", unit: "%", fmt: v => v.toFixed(1) + "%", higherBetter: true, source: "roe", note: "Cumulative fiscal year — resets each January" },
      npl:         { label: "NPL ratio",                      category: "asset_quality", unit: "%", fmt: v => v.toFixed(2) + "%", higherBetter: false, source: "npl_ratio" },
      provCov:     { label: "Provision coverage",             category: "asset_quality", unit: "×", fmt: v => v.toFixed(2) + "×", higherBetter: true,  source: "provision_coverage" },
      netNplEq:    { label: "Net NPLs / equity",              category: "asset_quality", unit: "%", fmt: v => v.toFixed(1) + "%", higherBetter: false, source: "net_npl_to_equity" },
      car:         { label: "Capital adequacy (CAR)",         category: "capital",     unit: "%", fmt: v => v.toFixed(1) + "%", higherBetter: true,  source: "car", note: "Regulatory floor 12%" },
      capToAssets: { label: "Capital / assets",               category: "capital",     unit: "%", fmt: v => v.toFixed(2) + "%", higherBetter: true,  source: "capital_to_assets" },
      liqA:        { label: "Liquidity / assets",             category: "liquidity",   unit: "%", fmt: v => v.toFixed(1) + "%", higherBetter: true,  source: "liquidity_to_assets" },
      liqD:        { label: "Liquidity / deposits",           category: "liquidity",   unit: "%", fmt: v => v.toFixed(1) + "%", higherBetter: true,  source: "liquidity_to_deposits" },
      shareLD:     { label: "Share loans + deposits",         category: "size",        unit: "%", fmt: v => v.toFixed(2) + "%", source: "share_of_loans_plus_deposits" },
      shareDep:    { label: "Share of deposits",              category: "size",        unit: "%", fmt: v => v.toFixed(2) + "%", source: "share_of_deposits" },
    };

    function fmtMoney(htgBn, qi = N_QUARTERS - 1, currency = "HTG") {
      if (htgBn == null) return "—";
      if (currency === "HTG") {
        if (htgBn >= 1000) return (htgBn / 1000).toFixed(2) + "T HTG";
        if (htgBn >= 10) return htgBn.toFixed(1) + "B HTG";
        return htgBn.toFixed(2) + "B HTG";
      }
      const usdM = htgBn * 1000 / fx[qi]; // bn HTG → m HTG → m USD
      if (usdM >= 1000) return "$" + (usdM / 1000).toFixed(2) + "B";
      if (usdM >= 10) return "$" + usdM.toFixed(0) + "M";
      return "$" + usdM.toFixed(1) + "M";
    }

    function fmtUsdLineValue(htgBn, qi) {
      return htgBn != null ? htgBn * 1000 / fx[qi] : null; // in $M
    }

    return { quarters, fx, banks, system, N_QUARTERS, metrics, legacy: raw.legacy, fmtMoney, fmtUsdLineValue };
  }

  window.buildHaitiData = buildHaitiData;
})();
