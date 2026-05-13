// Shared chart primitives — editorial style, hand-tuned SVG
// All charts assume R = window.React in scope

const { useState, useMemo, useRef, useEffect } = React;

// ---------- helpers ----------
function fmtNum(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const { digits = 1, currency = false, compact = false } = opts;
  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(digits) + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(digits) + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(digits) + "K";
    return n.toFixed(digits);
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtPct(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits) + "%";
}

// Convert HTG millions array → display values by currency
function convertSeries(htgVals, fxArr, currency) {
  if (currency === "HTG") return htgVals.map(v => v / 1000); // → HTG billions
  return htgVals.map((v, i) => v / fxArr[i]); // → USD millions
}

// ---------- Line chart ----------
function LineChart({ series, width = 600, height = 220, color = "#1c3a5e", strokeWidth = 1.6, fill = false, yLabel = "", xLabels = [], yFormat = (v) => fmtNum(v), padding = { t: 12, r: 12, b: 22, l: 38 }, showAxis = true, showDots = false, highlightLast = true, bands = [], textColor = "#7a6f5a", gridColor = "#d8cfbb", axisColor = null, bgBand = null }) {
  if (!series || series.length === 0) return null;
  // series can be: array of numbers (possibly with nulls), or array of {label, color, data:[]}
  const isPrimitive = !series.some(s => s && typeof s === "object" && "data" in s);
  const lines = isPrimitive
    ? [{ label: "", color, data: series }]
    : series;

  const w = width, h = height;
  const innerW = w - padding.l - padding.r;
  const innerH = h - padding.t - padding.b;

  const allVals = lines.flatMap(l => l.data).filter(v => Number.isFinite(v));
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yRange = yMax - yMin;
  yMin = yMin - yRange * 0.08;
  yMax = yMax + yRange * 0.12;

  const N = lines[0].data.length;
  const x = (i) => padding.l + (i / Math.max(1, N - 1)) * innerW;
  const y = (v) => padding.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  // Y ticks
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (i / yTicks) * (yMax - yMin));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: "var(--ed-mono)" }}>
      {/* bands */}
      {bands.map((b, i) => (
        <rect key={i} x={padding.l} y={y(b.to)} width={innerW} height={y(b.from) - y(b.to)} fill={b.color || "rgba(193,155,90,0.08)"} />
      ))}
      {/* grid */}
      {showAxis && ticks.map((t, i) => (
        <g key={i}>
          <line x1={padding.l} x2={w - padding.r} y1={y(t)} y2={y(t)} stroke={gridColor} strokeDasharray={i === 0 ? "" : "2 3"} strokeWidth={i === 0 ? 0.8 : 0.5} />
          <text x={padding.l - 5} y={y(t) + 3} fontSize="9" fill={textColor} textAnchor="end">{yFormat(t)}</text>
        </g>
      ))}
      {/* x labels */}
      {showAxis && xLabels.length > 0 && xLabels.map((lab, i) => {
        if (!lab) return null;
        return <text key={i} x={x(i)} y={h - padding.b + 12} fontSize="9" fill={textColor} textAnchor="middle">{lab}</text>;
      })}
      {/* lines */}
      {lines.map((l, li) => {
        // Build path segments skipping null/undefined/NaN values
        let path = "";
        let inSeg = false;
        l.data.forEach((v, i) => {
          if (v == null || !Number.isFinite(v)) { inSeg = false; return; }
          path += `${inSeg ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
          inSeg = true;
        });
        // Last defined index for endpoint marker
        let lastDef = -1;
        for (let i = l.data.length - 1; i >= 0; i--) { if (l.data[i] != null && Number.isFinite(l.data[i])) { lastDef = i; break; } }
        const areaPath = fill && path
          ? path + ` L${x(N - 1)} ${y(yMin)} L${x(0)} ${y(yMin)} Z`
          : null;
        return (
          <g key={li}>
            {fill && <path d={areaPath} fill={l.color || color} fillOpacity="0.12" />}
            <path d={path} fill="none" stroke={l.color || color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
            {showDots && l.data.map((v, i) => (
              (v != null && Number.isFinite(v)) ? <circle key={i} cx={x(i)} cy={y(v)} r={2} fill={l.color || color} /> : null
            ))}
            {highlightLast && lastDef >= 0 && (
              <circle cx={x(lastDef)} cy={y(l.data[lastDef])} r={3} fill={l.color || color} />
            )}
          </g>
        );
      })}
      {yLabel && (
        <text x={padding.l} y={padding.t - 2} fontSize="9" fill={textColor} fontStyle="italic">{yLabel}</text>
      )}
    </svg>
  );
}

// ---------- Bar chart ----------
function BarChart({ data, width = 600, height = 220, color = "#1c3a5e", padding = { t: 12, r: 12, b: 32, l: 38 }, yFormat = (v) => fmtNum(v), highlight = null, horizontal = false }) {
  const w = width, h = height;
  const innerW = w - padding.l - padding.r;
  const innerH = h - padding.t - padding.b;

  const vals = data.map(d => d.value);
  let yMin = Math.min(0, ...vals);
  let yMax = Math.max(...vals);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  yMax = yMax + (yMax - yMin) * 0.1;

  const N = data.length;
  const gap = 0.25;

  if (horizontal) {
    const x = (v) => padding.l + (v - yMin) / (yMax - yMin) * innerW;
    const bandH = innerH / N;
    const barH = bandH * (1 - gap);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: "var(--ed-mono)" }}>
        {/* baseline */}
        <line x1={x(0)} x2={x(0)} y1={padding.t} y2={h - padding.b} stroke="#a89c83" strokeWidth="0.8" />
        {data.map((d, i) => {
          const yPos = padding.t + i * bandH + (bandH - barH) / 2;
          const xStart = x(Math.min(0, d.value));
          const xEnd = x(Math.max(0, d.value));
          const isHi = highlight === d.label || highlight === d.id;
          return (
            <g key={i}>
              <rect x={xStart} y={yPos} width={xEnd - xStart} height={barH} fill={d.color || color} opacity={isHi ? 1 : (highlight ? 0.35 : 0.92)} />
              <text x={padding.l - 5} y={yPos + barH / 2 + 3} fontSize="9" fill="#3a3024" textAnchor="end">{d.label}</text>
              <text x={xEnd + 4} y={yPos + barH / 2 + 3} fontSize="9" fill="#3a3024">{yFormat(d.value)}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  const y = (v) => padding.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const bandW = innerW / N;
  const barW = bandW * (1 - gap);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: "var(--ed-mono)" }}>
      <line x1={padding.l} x2={w - padding.r} y1={y(0)} y2={y(0)} stroke="#a89c83" strokeWidth="0.8" />
      {data.map((d, i) => {
        const xPos = padding.l + i * bandW + (bandW - barW) / 2;
        const yPos = y(Math.max(0, d.value));
        const barH = Math.abs(y(0) - y(d.value));
        const isHi = highlight === d.label || highlight === d.id;
        return (
          <g key={i}>
            <rect x={xPos} y={yPos} width={barW} height={barH} fill={d.color || color} opacity={isHi ? 1 : (highlight ? 0.35 : 0.92)} />
            <text x={xPos + barW / 2} y={h - padding.b + 12} fontSize="9" fill="#3a3024" textAnchor="middle">{d.label}</text>
            <text x={xPos + barW / 2} y={yPos - 3} fontSize="9" fill="#3a3024" textAnchor="middle">{yFormat(d.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Sparkline ----------
function Sparkline({ data, width = 80, height = 22, color = "#1c3a5e", strokeWidth = 1.2, fill = false }) {
  if (!data || data.length === 0) return null;
  const valid = data.filter(v => v != null && Number.isFinite(v));
  if (valid.length === 0) return <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: "block" }} />;
  let yMin = Math.min(...valid), yMax = Math.max(...valid);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const N = data.length;
  const x = (i) => (i / (N - 1)) * (width - 2) + 1;
  const y = (v) => (1 - (v - yMin) / (yMax - yMin)) * (height - 4) + 2;
  let path = "";
  let inSeg = false;
  data.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) { inSeg = false; return; }
    path += `${inSeg ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    inSeg = true;
  });
  let lastDef = -1;
  for (let i = data.length - 1; i >= 0; i--) { if (data[i] != null && Number.isFinite(data[i])) { lastDef = i; break; } }
  const areaPath = fill && path ? path + ` L${x(N - 1)} ${height} L${x(0)} ${height} Z` : null;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: "block" }}>
      {fill && <path d={areaPath} fill={color} fillOpacity="0.15" />}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {lastDef >= 0 && <circle cx={x(lastDef)} cy={y(data[lastDef])} r={1.6} fill={color} />}
    </svg>
  );
}

// ---------- Treemap (squarified-lite, simple slice & dice) ----------
function Treemap({ data, width = 480, height = 280, palette }) {
  // simple slice-and-dice
  const total = data.reduce((s, d) => s + d.value, 0);
  // sort desc
  const sorted = [...data].sort((a, b) => b.value - a.value);
  // First split: top 2 get vertical column on left, rest on right
  // Actually let's do a clean recursive squarified-like approach with binary splits
  function layout(items, x, y, w, h) {
    if (items.length === 0) return [];
    if (items.length === 1) return [{ ...items[0], x, y, w, h }];
    const half = items.reduce((s, it) => s + it.value, 0) / 2;
    let acc = 0, splitIdx = 0;
    for (let i = 0; i < items.length; i++) {
      if (acc + items[i].value / 2 > half) { splitIdx = i; break; }
      acc += items[i].value;
      splitIdx = i + 1;
    }
    splitIdx = Math.max(1, Math.min(items.length - 1, splitIdx));
    const left = items.slice(0, splitIdx);
    const right = items.slice(splitIdx);
    const leftSum = left.reduce((s, it) => s + it.value, 0);
    const rightSum = right.reduce((s, it) => s + it.value, 0);
    const ratio = leftSum / (leftSum + rightSum);
    if (w >= h) {
      const split = w * ratio;
      return [...layout(left, x, y, split, h), ...layout(right, x + split, y, w - split, h)];
    } else {
      const split = h * ratio;
      return [...layout(left, x, y, w, split), ...layout(right, x, y + split, w, h - split)];
    }
  }
  const rects = layout(sorted, 0, 0, width, height);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: "var(--ed-sans)" }}>
      {rects.map((r, i) => (
        <g key={r.id || r.label || i}>
          <rect x={r.x + 1} y={r.y + 1} width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)} fill={r.color || palette?.[i % palette.length] || "#1c3a5e"} />
          {r.w > 50 && r.h > 30 && (
            <>
              <text x={r.x + 8} y={r.y + 18} fontSize="11" fill="#faf6ec" fontWeight="600" style={{ fontFamily: "var(--ed-sans)" }}>{r.label}</text>
              <text x={r.x + 8} y={r.y + 33} fontSize="14" fill="#faf6ec" fontWeight="700" style={{ fontFamily: "var(--ed-serif)" }}>{r.display || r.value.toFixed(1) + "%"}</text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

// ---------- Scatter ----------
function Scatter({ data, width = 480, height = 300, xLabel = "", yLabel = "", padding = { t: 14, r: 14, b: 32, l: 42 }, xFormat = (v) => fmtNum(v), yFormat = (v) => fmtNum(v), highlight = null }) {
  const w = width, h = height;
  const innerW = w - padding.l - padding.r;
  const innerH = h - padding.t - padding.b;
  const xs = data.map(d => d.x), ys = data.map(d => d.y);
  let xMin = Math.min(...xs), xMax = Math.max(...xs);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPad = (xMax - xMin) * 0.15 || 1;
  const yPad = (yMax - yMin) * 0.15 || 1;
  xMin -= xPad; xMax += xPad; yMin -= yPad; yMax += yPad;
  const x = v => padding.l + (v - xMin) / (xMax - xMin) * innerW;
  const y = v => padding.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const xTicks = 4, yTicks = 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: "var(--ed-mono)" }}>
      {/* grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = yMin + (i / yTicks) * (yMax - yMin);
        return <g key={"y" + i}>
          <line x1={padding.l} x2={w - padding.r} y1={y(v)} y2={y(v)} stroke="#d8cfbb" strokeDasharray={i === 0 ? "" : "2 3"} strokeWidth={i === 0 ? 0.8 : 0.5} />
          <text x={padding.l - 5} y={y(v) + 3} fontSize="9" fill="#7a6f5a" textAnchor="end">{yFormat(v)}</text>
        </g>;
      })}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const v = xMin + (i / xTicks) * (xMax - xMin);
        return <g key={"x" + i}>
          <line x1={x(v)} x2={x(v)} y1={padding.t} y2={h - padding.b} stroke="#d8cfbb" strokeDasharray={i === 0 ? "" : "2 3"} strokeWidth={i === 0 ? 0.8 : 0.5} />
          <text x={x(v)} y={h - padding.b + 12} fontSize="9" fill="#7a6f5a" textAnchor="middle">{xFormat(v)}</text>
        </g>;
      })}
      {data.map((d, i) => {
        const isHi = highlight === d.id || highlight === d.label;
        const r = d.r || 6;
        return (
          <g key={i} opacity={highlight && !isHi ? 0.35 : 1}>
            <circle cx={x(d.x)} cy={y(d.y)} r={r} fill={d.color || "#1c3a5e"} opacity="0.78" />
            <text x={x(d.x)} y={y(d.y) + 3.5} fontSize="9" fill="#faf6ec" textAnchor="middle" fontWeight="600">{d.label}</text>
          </g>
        );
      })}
      <text x={padding.l + innerW / 2} y={h - 2} fontSize="9.5" fill="#3a3024" textAnchor="middle" fontStyle="italic">{xLabel}</text>
      <text x={10} y={padding.t + innerH / 2} fontSize="9.5" fill="#3a3024" textAnchor="middle" fontStyle="italic" transform={`rotate(-90 10 ${padding.t + innerH / 2})`}>{yLabel}</text>
    </svg>
  );
}

// ---------- Heatmap (bank × metric or bank × time) ----------
function Heatmap({ rows, cols, values, width = 600, height = 220, cellGap = 1, colorScale, format = v => fmtNum(v), showColLabels = true, showRowLabels = true, padding = { t: 14, r: 8, b: 24, l: 70 } }) {
  const innerW = width - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;
  const cellW = innerW / cols.length;
  const cellH = innerH / rows.length;
  const flat = values.flat().filter(v => Number.isFinite(v));
  const vMin = Math.min(...flat), vMax = Math.max(...flat);
  const cs = colorScale || ((v) => {
    const t = (v - vMin) / (vMax - vMin || 1);
    // pale cream → navy
    const r = Math.round(247 + (28 - 247) * t);
    const g = Math.round(240 + (58 - 240) * t);
    const b = Math.round(220 + (94 - 220) * t);
    return `rgb(${r},${g},${b})`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: "var(--ed-mono)" }}>
      {showColLabels && cols.map((c, i) => (
        <text key={"c" + i} x={padding.l + i * cellW + cellW / 2} y={padding.t - 4} fontSize="9" fill="#3a3024" textAnchor="middle">{c}</text>
      ))}
      {showRowLabels && rows.map((r, i) => (
        <text key={"r" + i} x={padding.l - 6} y={padding.t + i * cellH + cellH / 2 + 3} fontSize="9.5" fill="#3a3024" textAnchor="end">{r}</text>
      ))}
      {rows.map((r, ri) => values[ri].map((v, ci) => (
        <g key={ri + "-" + ci}>
          <rect x={padding.l + ci * cellW + cellGap / 2} y={padding.t + ri * cellH + cellGap / 2} width={cellW - cellGap} height={cellH - cellGap} fill={cs(v)} />
          {cellW > 36 && cellH > 18 && (
            <text x={padding.l + ci * cellW + cellW / 2} y={padding.t + ri * cellH + cellH / 2 + 3} fontSize="9" fill={((v - vMin) / (vMax - vMin || 1)) > 0.55 ? "#faf6ec" : "#3a3024"} textAnchor="middle">{format(v)}</text>
          )}
        </g>
      )))}
    </svg>
  );
}

// Export to window
Object.assign(window, { LineChart, BarChart, Sparkline, Treemap, Scatter, Heatmap, fmtNum, fmtPct, convertSeries });
