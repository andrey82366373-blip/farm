// Столбики по месяцам. Цвета проверены на различимость при дальтонизме.
// Нажатие на месяц выделяет его и показывает точные суммы под графиком.
const compact = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.', ',')} млн` : v >= 1e3 ? `${Math.round(v / 1e3)} тыс` : String(Math.round(v)));

export default function BarChart({ rows, series, selected, onSelect, height = 200, label, readout }) {
  const W = 340, top = 22, bottom = 26, left = 4;
  const H = height;
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => r.values[s.key] || 0)));
  const slot = (W - left) / rows.length;
  const n = series.length;
  const bw = Math.min(16, (slot - 6) / n);
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const grid = [max / 2, max];
  return (
    <div className="card chart">
      {series.length > 1 && (
        <div className="chart-legend">{series.map((s) => <span key={s.key} className={`lg lg-${s.cls}`}>{s.label}</span>)}</div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {grid.map((g) => <line key={g} x1={left} x2={W} y1={y(g)} y2={y(g)} className="grid" />)}
        <text x={W} y={y(max) - 6} className="tick" textAnchor="end">{compact(max)}</text>
        <line x1={left} x2={W} y1={y(0)} y2={y(0)} className="axis" />
        {rows.map((r, i) => {
          const cx = left + i * slot + slot / 2;
          const on = selected === r.key;
          return (
            <g key={r.key} className={`bar-group ${on ? 'on' : ''} ${r.dim ? 'dim' : ''}`} onClick={() => onSelect?.(r.key)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              <rect x={cx - slot / 2} y={0} width={slot} height={H} className="hit" />
              {on && <rect x={cx - slot / 2 + 1} y={top - 8} width={slot - 2} height={y(0) - top + 8} rx="6" className="sel" />}
              {series.map((s, k) => {
                const v = r.values[s.key] || 0;
                if (!v) return null;
                const x = cx - (n * bw + (n - 1) * 2) / 2 + k * (bw + 2);
                const h = Math.max(2, y(0) - y(v));
                return <path key={s.key} className={`bar-${s.cls}`} d={`M${x},${y(0)} v${-(h - 3)} q0,-3 3,-3 h${bw - 6} q3,0 3,3 v${h - 3} z`} />;
              })}
              <text x={cx} y={H - 8} className={`mon ${on ? 'on' : ''}`}>{r.label}</text>
            </g>
          );
        })}
      </svg>
      {readout}
    </div>
  );
}
