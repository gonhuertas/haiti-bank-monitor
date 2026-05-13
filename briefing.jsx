// Quarterly briefing — LLM-summarized developments for the as-of quarter.
// Replaces the flags table on the System Monitor.

function QuarterlyBriefing({ asOf, onPickBank }) {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Build context payload from the data, then call Claude.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSummary(null);
    setError(null);

    const ctx = buildBriefingContext(asOf);

    const prompt = `You are an experienced financial-sector analyst writing a quarterly briefing on Haiti's commercial banking system for a peer who already knows the country and the banks. Avoid generic framing ("the banking sector saw…"), avoid restating thresholds, avoid hedging. Be specific: name banks, quote numbers, identify what moved meaningfully.

WRITE 4–6 sentences in plain prose, no bullets, no headings. Tone: dry, factual, observational. Reference banks by their ticker (UNIBK, SOGEBK, BNC, CAPITALBK, BUH, SOGEBL, CBNA, BPH). Numbers in parentheses where useful, e.g. "(NPL +210 bp to 39.8%)". Lead with the most material developments; close with one watch-item if relevant.

QUARTER: ${ctx.quarterLabel}

SYSTEM AGGREGATES (this quarter | QoQ Δ | YoY Δ):
${ctx.systemLines.join('\n')}

LARGEST BANK-LEVEL MOVES THIS QUARTER:
${ctx.bankMoves.map(m => `  ${m.bank} · ${m.indicator}: ${m.cur} (QoQ ${m.qoq}, YoY ${m.yoy})`).join('\n')}

CREDIT POSTURE — YoY gross loan growth, by bank:
${ctx.creditLines.join('\n')}

SHARE-OF-SYSTEM-ASSETS DRIFT — YoY change in share, by bank:
${ctx.shareLines.join('\n')}

Write the briefing now. Do not preface it with a heading or salutation.`;

    // window.claude.complete is only available inside the Claude Design
    // preview environment. In production (GitHub Pages, localhost, etc.)
    // it's undefined. Fall back to a static message until we wire a real
    // LLM path (pre-generated briefings.json or proxied Anthropic API).
    const llm = window.claude && typeof window.claude.complete === 'function'
      ? window.claude.complete.bind(window.claude)
      : null;

    if (!llm) {
      setError('LLM not wired up in this environment');
      setLoading(false);
      return () => { cancelled = true; };
    }

    llm(prompt).then(text => {
      if (cancelled) return;
      setSummary((text || '').trim());
      setLoading(false);
    }).catch(e => {
      if (cancelled) return;
      setError(e.message || 'Failed to generate briefing');
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [asOf]);

  return (
    <div>
      <div className="section-head">
        <h2>Quarterly briefing · {fmt.qtr(asOf)}</h2>
        <div className="section-meta">
          {loading ? (
            <span><span className="dotmark neutral pulse"></span>Generating…</span>
          ) : error ? (
            <span style={{ color: 'var(--red)' }}>Error</span>
          ) : (
            <span style={{ color: 'var(--ink-soft)' }}>Claude · system + bank moves</span>
          )}
        </div>
      </div>

      <div className="briefing">
        {loading && (
          <div className="briefing-skel">
            <div className="skel-line" style={{ width: '92%' }}></div>
            <div className="skel-line" style={{ width: '88%' }}></div>
            <div className="skel-line" style={{ width: '94%' }}></div>
            <div className="skel-line" style={{ width: '80%' }}></div>
            <div className="skel-line" style={{ width: '70%' }}></div>
          </div>
        )}
        {error && (
          <div className="note" style={{ fontStyle: 'normal', color: 'var(--red)' }}>
            Briefing unavailable: {error}
          </div>
        )}
        {summary && (
          <BriefingText text={summary} onPickBank={onPickBank} />
        )}
      </div>

      <div className="note" style={{ marginTop: 14, borderTop: '1px solid var(--rule-soft)', paddingTop: 8 }}>
        Generated from the underlying BRH series each time the <em>as-of</em> date changes; no human curation. Bank tickers link to the deep-dive. Treat as a first read, not a sign-off.
      </div>
    </div>
  );
}

// Light formatter — turns bank tickers into clickable buttons.
function BriefingText({ text, onPickBank }) {
  const tickers = ["UNIBK","SOGEBK","BNC","CAPITALBK","BUH","SOGEBL","CBNA","BPH","BHD","PROMOBK","SCOTIA","SOCABK","SYSTÈME"];
  // Split into runs, linkifying tickers (word-boundary match).
  const re = new RegExp("\\b(" + tickers.join("|") + ")\\b", "g");
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: 'text', v: text.slice(last, m.index) });
    parts.push({ t: 'tick', v: m[1] });
    last = m.index + m[1].length;
  }
  if (last < text.length) parts.push({ t: 'text', v: text.slice(last) });

  return (
    <p className="briefing-prose">
      {parts.map((p, i) => p.t === 'text'
        ? <React.Fragment key={i}>{p.v}</React.Fragment>
        : p.v === "SYSTÈME"
          ? <span key={i} className="briefing-tick" style={{ borderBottom: 'none', cursor: 'default' }}>{p.v}</span>
          : <button key={i} className="briefing-tick" onClick={() => onPickBank(p.v)}>{p.v}</button>
      )}
    </p>
  );
}

// Build a compact context payload from window.__BANK_DATA.
function buildBriefingContext(asOf) {
  const banks = window.activeBanksAt(asOf);
  const allDates = window.indicatorDates('total_assets');
  const prevQtr = allDates[allDates.length - 2];
  const yearAgo = allDates[allDates.length - 5];

  // System aggregates table
  const sysIndicators = [
    { id: 'car', label: 'System CAR', fmt: v => fmt.pct(v, 1), deltaPct: true },
    { id: 'npl_ratio', label: 'System NPL ratio', fmt: v => fmt.pct(v, 1), deltaPct: true },
    { id: 'liquidity_to_deposits', label: 'System Liquidity/Deposits', fmt: v => fmt.pct(v, 1), deltaPct: true },
    { id: 'capital_to_assets', label: 'System Capital/Assets', fmt: v => fmt.pct(v, 1), deltaPct: true },
    { id: 'provision_coverage', label: 'System Provision coverage', fmt: v => v.toFixed(2) + 'x', deltaPct: false },
    { id: 'roa', label: 'System ROA', fmt: v => fmt.pct(v, 2), deltaPct: true },
    { id: 'roe', label: 'System ROE', fmt: v => fmt.pct(v, 1), deltaPct: true },
    { id: 'total_assets', label: 'System Total Assets (HTG bn)', fmt: v => v.toFixed(0), deltaPct: false }
  ];
  const systemLines = sysIndicators.map(si => {
    const cur = window.atDate(si.id, SYSTEM_KEY, asOf);
    const prev = prevQtr ? window.atDate(si.id, SYSTEM_KEY, prevQtr) : null;
    const ya = yearAgo ? window.atDate(si.id, SYSTEM_KEY, yearAgo) : null;
    if (cur == null) return null;
    const qoq = (prev != null) ? (si.deltaPct ? fmt.ppSigned(cur - prev, 1) : ((cur - prev) / Math.abs(prev) * 100).toFixed(1) + '%') : '—';
    const yoy = (ya != null) ? (si.deltaPct ? fmt.ppSigned(cur - ya, 1) : ((cur - ya) / Math.abs(ya) * 100).toFixed(1) + '%') : '—';
    return `  ${si.label}: ${si.fmt(cur)} | QoQ ${qoq} | YoY ${yoy}`;
  }).filter(Boolean);

  // Largest bank-level moves: NPL ratio QoQ, CAR QoQ, gross loans QoQ
  const moves = [];
  const moveIndicators = [
    { id: 'npl_ratio', label: 'NPL ratio', fmt: v => fmt.pct(v, 1), pp: true },
    { id: 'car', label: 'CAR', fmt: v => fmt.pct(v, 1), pp: true },
    { id: 'capital_to_assets', label: 'Capital/Assets', fmt: v => fmt.pct(v, 1), pp: true },
    { id: 'liquidity_to_deposits', label: 'Liquidity/Deposits', fmt: v => fmt.pct(v, 1), pp: true },
    { id: 'provision_coverage', label: 'Provision coverage', fmt: v => v.toFixed(2) + 'x', pp: false },
    { id: 'roe', label: 'ROE', fmt: v => fmt.pct(v, 1), pp: true }
  ];
  for (const b of banks) {
    for (const mi of moveIndicators) {
      const cur = window.atDate(mi.id, b, asOf);
      const prev = prevQtr ? window.atDate(mi.id, b, prevQtr) : null;
      const ya = yearAgo ? window.atDate(mi.id, b, yearAgo) : null;
      if (cur == null || prev == null) continue;
      const dQoQ = cur - prev;
      const dYoY = ya != null ? cur - ya : null;
      moves.push({
        bank: b, indicator: mi.label,
        cur: mi.fmt(cur),
        qoq: mi.pp ? fmt.ppSigned(dQoQ, 1) : ((cur/prev - 1) * 100).toFixed(1) + '%',
        yoy: dYoY != null ? (mi.pp ? fmt.ppSigned(dYoY, 1) : ((cur/ya - 1) * 100).toFixed(1) + '%') : '—',
        magnitude: Math.abs(dQoQ),
        // weight by indicator importance (NPL & CAR matter most to the analyst)
        weight: (mi.id === 'npl_ratio' || mi.id === 'car') ? Math.abs(dQoQ) * 2.0 :
                (mi.id === 'provision_coverage') ? Math.abs(dQoQ) * 0.5 :
                Math.abs(dQoQ)
      });
    }
  }
  moves.sort((a,b) => b.weight - a.weight);
  const bankMoves = moves.slice(0, 14);

  // Credit posture — YoY gross loan growth by bank
  const creditLines = banks.map(b => {
    const cur = window.atDate('gross_loans', b, asOf);
    const ya = yearAgo ? window.atDate('gross_loans', b, yearAgo) : null;
    if (cur == null || ya == null || ya === 0) return null;
    const yoy = (cur - ya) / Math.abs(ya);
    return `  ${b}: ${fmt.pctSigned(yoy, 1)}`;
  }).filter(Boolean);

  // Share drift
  const shareLines = banks.map(b => {
    const cur = window.atDate('share_of_system_assets', b, asOf);
    const ya = yearAgo ? window.atDate('share_of_system_assets', b, yearAgo) : null;
    if (cur == null || ya == null) return null;
    const d = cur - ya;
    return `  ${b}: ${fmt.pct(cur, 2)} (Δ ${fmt.ppSigned(d, 2)})`;
  }).filter(Boolean);

  return {
    quarterLabel: fmt.qtr(asOf),
    systemLines,
    bankMoves,
    creditLines,
    shareLines
  };
}

window.QuarterlyBriefing = QuarterlyBriefing;
