// SVG chart primitives. All hand-rolled — no chart libraries.

const { useMemo, useState, useRef, useEffect } = React;

// ——— scale helpers ———

function linearScale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = (d1 - d0) || 1;
  return v => r0 + ((v - d0) / span) * (r1 - r0);
}

function niceTicks(min, max, count = 4) {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  let step;
  if (norm < 1.5) step = mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let t = start; t <= max + 1e-9; t += step) ticks.push(+t.toFixed(10));
  return ticks;
}

window.linearScale = linearScale;
window.niceTicks = niceTicks;

// ——— Tooltip global ———

window.__tooltip = null;
window.showTip = function(html, x, y) {
  let el = document.getElementById('__tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = '__tooltip';
    el.className = 'tooltip';
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.style.display = 'block';
  // position
  const rect = el.getBoundingClientRect();
  let px = x + 12, py = y + 12;
  if (px + rect.width > window.innerWidth - 8) px = x - rect.width - 12;
  if (py + rect.height > window.innerHeight - 8) py = y - rect.height - 12;
  el.style.left = px + 'px';
  el.style.top = py + 'px';
};
window.hideTip = function() {
  const el = document.getElementById('__tooltip');
  if (el) el.style.display = 'none';
};

// ——— Sparkline (tiny line, no axes) ———

function Sparkline({ data, width = 120, height = 28, color = "var(--navy)", refLine = null, refColor = "var(--clay)", fill = false, format, fullWidth = false }) {
  if (!data || data.length < 2) {
    return <svg width={fullWidth ? "100%" : width} height={height}></svg>;
  }
  const vals = data.map(d => d.value).filter(v => v != null);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (refLine != null) { min = Math.min(min, refLine); max = Math.max(max, refLine); }
  if (min === max) { min -= 1; max += 1; }
  const pad = 3;
  const x = linearScale([0, data.length - 1], [pad, width - pad]);
  const y = linearScale([min, max], [height - pad, pad]);
  const path = data.map((d, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(d.value).toFixed(1)).join(" ");
  const area = fill ? path + ` L ${x(data.length - 1).toFixed(1)} ${height - pad} L ${x(0).toFixed(1)} ${height - pad} Z` : null;
  const last = data[data.length - 1];
  return (
    <svg className="chart" width={fullWidth ? "100%" : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} opacity="0.08" />}
      {refLine != null && (
        <line x1={pad} x2={width - pad} y1={y(refLine)} y2={y(refLine)} className="ref-line" stroke={refColor} vectorEffect="non-scaling-stroke" />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(data.length - 1)} cy={y(last.value)} r="2.2" fill={color} />
    </svg>
  );
}

window.Sparkline = Sparkline;

// ——— Line chart (with axes) ———

function LineChart({
  series,            // [{ name, color, dash, data: [{date,value}] }, ...]
  width = 460,
  height = 220,
  margin = { top: 14, right: 20, bottom: 28, left: 44 },
  yFormat,
  refs = [],         // [{value, label, color}]
  yMinHint,
  yMaxHint,
  yTickCount = 4,
  xTickEvery = 4,
  showZero = false
}) {
  if (!series || series.length === 0) return <svg width={width} height={height}></svg>;
  // collect all dates union
  const dateSet = new Set();
  series.forEach(s => s.data.forEach(p => dateSet.add(p.date)));
  const dates = [...dateSet].sort();
  if (dates.length < 2) return <svg width={width} height={height}></svg>;
  // domain
  const allVals = [];
  series.forEach(s => s.data.forEach(p => { if (p.value != null) allVals.push(p.value); }));
  refs.forEach(r => allVals.push(r.value));
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  if (yMinHint != null) yMin = Math.min(yMin, yMinHint);
  if (yMaxHint != null) yMax = Math.max(yMax, yMaxHint);
  if (showZero) yMin = Math.min(yMin, 0);
  const ySpan = yMax - yMin || 1;
  yMin -= ySpan * 0.08; yMax += ySpan * 0.08;

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const x = linearScale([0, dates.length - 1], [0, innerW]);
  const y = linearScale([yMin, yMax], [innerH, 0]);
  const dateIndex = new Map(dates.map((d, i) => [d, i]));

  const yTicks = niceTicks(yMin, yMax, yTickCount);
  const fmtY = yFormat || (v => v.toFixed(2));

  return (
    <svg className="chart" width={width} height={height}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* grid */}
        <g className="grid">
          {yTicks.map((t, i) => (
            <line key={i} x1="0" x2={innerW} y1={y(t)} y2={y(t)} stroke="var(--rule-soft)" />
          ))}
        </g>
        {/* y-axis ticks */}
        <g className="axis">
          {yTicks.map((t, i) => (
            <text key={i} x="-8" y={y(t)} dy="0.32em" textAnchor="end">{fmtY(t)}</text>
          ))}
          <line x1="0" x2="0" y1="0" y2={innerH} stroke="var(--rule)" />
        </g>
        {/* x-axis ticks (every Nth) */}
        <g className="axis">
          <line x1="0" x2={innerW} y1={innerH} y2={innerH} stroke="var(--ink)" />
          {dates.map((d, i) => {
            if (i % xTickEvery !== 0 && i !== dates.length - 1) return null;
            return (
              <g key={d} transform={`translate(${x(i)},${innerH})`}>
                <line y1="0" y2="3" stroke="var(--ink)" />
                <text y="14" textAnchor="middle">{fmt.qtrShort(d)}</text>
              </g>
            );
          })}
        </g>
        {/* reference lines */}
        {refs.map((r, i) => (
          <g key={i}>
            <line x1="0" x2={innerW} y1={y(r.value)} y2={y(r.value)} className="ref-line" stroke={r.color || "var(--clay)"} />
            <text x={innerW} y={y(r.value) - 4} textAnchor="end" className="ref-label" fill={r.color || "var(--clay-deep)"}>
              {r.label}
            </text>
          </g>
        ))}
        {/* series */}
        {series.map((s, si) => {
          const pts = s.data.filter(p => p.value != null && dateIndex.has(p.date));
          const path = pts.map((p, i) => (i === 0 ? "M" : "L") + x(dateIndex.get(p.date)).toFixed(1) + " " + y(p.value).toFixed(1)).join(" ");
          return (
            <g key={si}>
              {s.fill && (
                <path d={path + ` L ${x(dateIndex.get(pts[pts.length-1].date))} ${innerH} L ${x(dateIndex.get(pts[0].date))} ${innerH} Z`} fill={s.color} opacity="0.07" />
              )}
              <path d={path} fill="none" stroke={s.color} strokeWidth={s.width || 1.6}
                strokeDasharray={s.dash ? "3 3" : null} />
              {s.dots && pts.map((p, i) => (
                <circle key={i} cx={x(dateIndex.get(p.date))} cy={y(p.value)} r="2" fill={s.color} />
              ))}
            </g>
          );
        })}
        {/* hover overlay */}
        <rect x="0" y="0" width={innerW} height={innerH} fill="transparent"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const idx = Math.round((mx / innerW) * (dates.length - 1));
            const d = dates[Math.max(0, Math.min(dates.length - 1, idx))];
            const rows = series.map(s => {
              const p = s.data.find(p => p.date === d);
              return `<div class="row"><span><span class="dotmark" style="background:${s.color}"></span>${s.name}</span><span>${p && p.value != null ? fmtY(p.value) : '—'}</span></div>`;
            }).join('');
            window.showTip(`<b>${fmt.qtr(d)}</b><div style="margin-top:4px">${rows}</div>`, e.clientX, e.clientY);
          }}
          onMouseLeave={() => window.hideTip()}
        />
      </g>
    </svg>
  );
}

window.LineChart = LineChart;

// ——— Horizontal bar chart (banks vs. metric) ———

function BarChart({
  rows,              // [{ label, value, color?, status? }]
  width = 460,
  height = 220,
  margin = { top: 10, right: 60, bottom: 24, left: 88 },
  xFormat,
  refs = [],
  xMin = 0,
  xMaxHint
}) {
  if (!rows || rows.length === 0) return <svg width={width} height={height}></svg>;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const vals = rows.map(r => r.value).filter(v => v != null);
  let xMax = Math.max(...vals, ...(refs.map(r => r.value)));
  if (xMaxHint != null) xMax = Math.max(xMax, xMaxHint);
  if (xMin > 0 && Math.min(...vals) < 0) {} // keep
  let xMinUse = Math.min(xMin, ...vals);
  if (xMinUse > 0) xMinUse = 0;
  const x = linearScale([xMinUse, xMax * 1.04], [0, innerW]);
  const bandH = innerH / rows.length;
  const fmt = xFormat || (v => v.toFixed(2));
  const xTicks = niceTicks(xMinUse, xMax, 4);

  return (
    <svg className="chart" width={width} height={height}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* grid */}
        <g className="grid">
          {xTicks.map((t, i) => (
            <line key={i} x1={x(t)} x2={x(t)} y1="0" y2={innerH} stroke="var(--rule-soft)" />
          ))}
        </g>
        {/* zero/baseline */}
        <line x1={x(0)} x2={x(0)} y1="0" y2={innerH} stroke="var(--rule)" />
        {/* bars */}
        {rows.map((r, i) => {
          const yPos = i * bandH;
          const barW = x(r.value) - x(0);
          const fill = r.color || (r.status === 'breach' ? 'var(--red)' : r.status === 'watch' ? 'var(--ochre)' : 'var(--navy)');
          return (
            <g key={r.label} transform={`translate(0,${yPos})`}>
              <text x="-10" y={bandH/2} dy="0.32em" textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', fill: 'var(--ink)' }}>{r.label}</text>
              <rect x={barW < 0 ? x(r.value) : x(0)} y={bandH * 0.18} width={Math.abs(barW)} height={bandH * 0.64} fill={fill} />
              <text x={Math.max(x(r.value), x(0)) + 4} y={bandH/2} dy="0.32em" style={{ fontFamily: 'var(--mono)', fontSize: '10px', fill: 'var(--ink-soft)' }}>
                {fmt(r.value)}
              </text>
            </g>
          );
        })}
        {/* refs */}
        {refs.map((r, i) => (
          <g key={i}>
            <line x1={x(r.value)} x2={x(r.value)} y1="0" y2={innerH} className="ref-line" stroke={r.color || "var(--clay)"} />
            <text x={x(r.value)} y={-3} textAnchor="middle" className="ref-label" fill={r.color || "var(--clay-deep)"}>
              {r.label}
            </text>
          </g>
        ))}
        {/* x ticks */}
        <g className="axis" transform={`translate(0,${innerH})`}>
          <line x1="0" x2={innerW} stroke="var(--ink)" />
          {xTicks.map((t, i) => (
            <g key={i} transform={`translate(${x(t)},0)`}>
              <line y1="0" y2="3" stroke="var(--ink)" />
              <text y="14" textAnchor="middle">{fmt(t)}</text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}

window.BarChart = BarChart;

// ——— Heatmap (banks × quarters) ———

function Heatmap({ banks, dates, values, colorScale, format, cellW = 38, cellH = 22, labelW = 80, refValue = null }) {
  // values: function(bank, date) => number|null
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="heatmap" style={{ minWidth: labelW + dates.length * cellW }}>
        <thead>
          <tr>
            <th style={{ width: labelW, textAlign: 'left' }}>Bank</th>
            {dates.map(d => (
              <th key={d} style={{ minWidth: cellW }}>{fmt.qtrShort(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {banks.map(b => (
            <tr key={b}>
              <td className="label">{b}</td>
              {dates.map(d => {
                const v = values(b, d);
                if (v == null) {
                  return <td key={d} className="cell empty" style={{ height: cellH }}>—</td>;
                }
                const bg = colorScale(v);
                const txt = format(v);
                const dark = isDarkBg(bg);
                return (
                  <td key={d} className="cell" style={{
                    background: bg,
                    color: dark ? 'rgba(255,255,255,0.94)' : 'var(--ink)',
                    height: cellH,
                    fontWeight: refValue != null && v > refValue ? 600 : 400
                  }}
                  onMouseEnter={(e) => window.showTip(`<b>${b} — ${fmt.qtr(d)}</b><div style="margin-top:2px">${txt}</div>`, e.clientX, e.clientY)}
                  onMouseMove={(e) => window.showTip(`<b>${b} — ${fmt.qtr(d)}</b><div style="margin-top:2px">${txt}</div>`, e.clientX, e.clientY)}
                  onMouseLeave={() => window.hideTip()}>
                    {txt}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isDarkBg(bg) {
  // Very rough — assume any cell with high alpha clay/red is dark
  if (!bg) return false;
  const m = bg.match(/rgba?\(([\d\.,\s]+)\)/);
  if (!m) return false;
  const parts = m[1].split(',').map(s => parseFloat(s));
  const [r, g, b] = parts;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b);
  const a = parts[3] != null ? parts[3] : 1;
  return lum < 130 && a > 0.55;
}

window.Heatmap = Heatmap;

// ——— Color scales ———

// NPL: low = paper, high = clay/red
window.nplColor = function(v) {
  // 0 → cream; 0.05 → ochre tint; 0.10 → clay; 0.20+ → deep red
  if (v == null || isNaN(v)) return 'transparent';
  const t = Math.max(0, Math.min(1, v / 0.30));
  // interpolate cream -> clay -> red
  const stops = [
    [0.00, [251, 246, 233]],   // cream
    [0.17, [232, 196, 138]],   // warm sand
    [0.33, [213, 137, 99]],    // clay-soft
    [0.55, [181, 83, 46]],     // clay
    [0.85, [138, 56, 35]],     // clay-deep
    [1.00, [90, 32, 22]]       // dark
  ];
  return interpStops(t, stops);
};

window.coverageColor = function(v) {
  // 0 → red (low coverage bad); 1 → cream (OK); 1.5+ → navy (over-provisioned)
  if (v == null || isNaN(v)) return 'transparent';
  const t = Math.max(0, Math.min(1, v / 2.0));
  const stops = [
    [0.00, [169, 56, 38]],     // red
    [0.25, [213, 137, 99]],    // clay-soft
    [0.50, [251, 246, 233]],   // cream
    [0.75, [124, 154, 184]],   // navy soft
    [1.00, [31, 58, 95]]       // navy
  ];
  return interpStops(t, stops);
};

window.carColor = function(v) {
  // <12 red, 12-14 amber, 14+ navy
  if (v == null || isNaN(v)) return 'transparent';
  if (v < 0.12) return 'rgba(169, 56, 38, 0.85)';
  if (v < 0.14) return 'rgba(182, 136, 33, 0.55)';
  if (v < 0.20) return 'rgba(251, 246, 233, 1)';
  if (v < 0.30) return 'rgba(124, 154, 184, 0.45)';
  return 'rgba(31, 58, 95, 0.75)';
};

window.deltaColor = function(v) {
  if (v == null || isNaN(v)) return 'transparent';
  // diverging around 0
  if (v > 0) {
    const t = Math.min(1, v / 0.20);
    const stops = [[0,[251,246,233]],[1,[70,112,58]]];
    return interpStops(t, stops);
  } else {
    const t = Math.min(1, -v / 0.20);
    const stops = [[0,[251,246,233]],[1,[169,56,38]]];
    return interpStops(t, stops);
  }
};

function interpStops(t, stops) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * u);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * u);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * u);
      return `rgba(${r},${g},${b},0.92)`;
    }
  }
  const c = stops[stops.length - 1][1];
  return `rgba(${c[0]},${c[1]},${c[2]},0.92)`;
}

window.interpStops = interpStops;

Object.assign(window, { Sparkline, LineChart, BarChart, Heatmap });
