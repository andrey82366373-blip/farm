import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { useAnimals } from '../lib/data.js';
import { SPECIES, SPECIES_LIST, causeLabel } from '../lib/domain.js';
import { fmtMonth, fmtDate, today, MONTHS_SHORT } from '../lib/format.js';
import { useKeep } from '../lib/router.js';
import { Screen, Chips, Segmented, Button, Empty } from '../components/ui.jsx';
import { withSpecies, metrics, seasons, seasonTitle, monthRange, shiftMonth, yearMonths } from '../lib/stats.js';

function MetricGrid({ m }) {
  const items = [
    { label: 'Родилось', v: m.born, tone: 'green' },
    { label: 'Пало', v: m.died + m.stillborn, tone: 'red', sub: m.stillborn ? `из них мёртворожд.: ${m.stillborn}` : null },
    { label: 'Куплено', v: m.bought, tone: 'sky' },
    { label: 'Продано', v: m.sold, tone: 'tag' },
    { label: 'Забито', v: m.slaughtered, tone: 'earth' },
  ];
  const causes = Object.entries(m.causes);
  return (
    <>
      <div className="metrics">
        {items.map((x) => (
          <div key={x.label} className={`metric tone-${x.tone}`}>
            <span>{x.label}</span>
            <b>{x.v}</b>
            {x.sub && <small>{x.sub}</small>}
          </div>
        ))}
      </div>
      {causes.length > 0 && (
        <div className="card causes">
          <div className="row-title">Причины падежа</div>
          {causes.sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <div key={k} className="cause"><span>{causeLabel(k)}</span><b>{n}</b></div>
          ))}
        </div>
      )}
    </>
  );
}

// Столбики по месяцам: родилось и пало.
function YearChart({ evs, species, year }) {
  const data = yearMonths(year).map((ym) => {
    const m = metrics(evs, { species, ...monthRange(ym) });
    return { ym, born: m.born, died: m.died + m.stillborn };
  });
  const max = Math.max(1, ...data.map((d) => Math.max(d.born, d.died)));
  const W = 340, H = 190, top = 18, bottom = 26, left = 4, slot = (W - left) / 12, bw = slot * 0.34;
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const ticks = max <= 4 ? [max] : [Math.round(max / 2), max];
  return (
    <div className="card chart">
      <div className="chart-legend"><span className="lg lg-born">Родилось</span><span className="lg lg-died">Пало</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Рождения и падёж по месяцам ${year} года`}>
        {ticks.map((t) => <line key={t} x1={left} x2={W} y1={y(t)} y2={y(t)} className="grid" />)}
        <line x1={left} x2={W} y1={y(0)} y2={y(0)} className="axis" />
        {data.map((d, i) => {
          const x = left + i * slot + slot / 2;
          return (
            <g key={d.ym}>
              {d.born > 0 && <rect x={x - bw - 1} y={y(d.born)} width={bw} height={y(0) - y(d.born)} rx="3" className="bar-born" />}
              {d.died > 0 && <rect x={x + 1} y={y(d.died)} width={bw} height={y(0) - y(d.died)} rx="3" className="bar-died" />}
              {d.born > 0 && <text x={x - bw / 2 - 1} y={y(d.born) - 4} className="val">{d.born}</text>}
              {d.died > 0 && <text x={x + bw / 2 + 1} y={y(d.died) - 4} className="val">{d.died}</text>}
              <text x={x} y={H - 8} className="mon">{MONTHS_SHORT[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Stats() {
  const animals = useAnimals();
  const events = useLiveQuery(() => db.events.toArray(), []);
  const [species, setSpecies] = useKeep('stats.species', 'sheep');
  const [mode0, setMode] = useKeep('stats.mode', 'season');
  const [ym, setYm] = useKeep('stats.ym', today().slice(0, 7));
  const [year, setYear] = useKeep('stats.year', Number(today().slice(0, 4)));

  const mode = !species && mode0 === 'season' ? 'month' : mode0;
  const byId = useMemo(() => new Map((animals || []).map((a) => [a.id, a])), [animals]);
  const evs = useMemo(() => withSpecies(events || [], byId), [events, byId]);
  const seas = useMemo(() => (species ? seasons(evs, byId, species) : []), [evs, byId, species]);

  if (!animals || !events) return <Screen title="Статистика" />;
  const word = species ? SPECIES[species].birthWord : 'Окот';
  const cur = today().slice(0, 7);

  return (
    <Screen title="Статистика" backTo="/journal">
      <Chips
        wrap={false}
        value={species}
        onChange={(v) => { setSpecies(v); if (!v && mode === 'season') setMode('month'); }}
        options={[...SPECIES_LIST.map((s) => ({ value: s.key, label: s.many, icon: s.icon })), { value: null, label: 'Все виды' }]}
      />
      <Segmented
        options={[...(species ? [{ value: 'season', label: word }] : []), { value: 'month', label: 'Месяц' }, { value: 'year', label: 'Год' }]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'season' && species && (
        seas.length === 0 ? (
          <Empty icon="birth" title="Рождений пока не было" text={`Когда запишете ${word.toLowerCase()}, здесь появится итог: сколько родилось и сколько сохранилось.`} />
        ) : (
          <div className="list">
            {seas.map((s) => (
              <div key={s.from} className="card season">
                <h2>{seasonTitle(word, s)}</h2>
                <div className="pill-note">{s.from === s.to ? fmtDate(s.from, { year: true }) : `${fmtDate(s.from, { year: true })} – ${fmtDate(s.to, { year: true })}`}{s.mothers ? `, матерей: ${s.mothers}` : ''}</div>
                <div className="metrics">
                  <div className="metric tone-green"><span>Родилось</span><b>{s.born}</b><small>{SPECIES[species].babyLabel.f.toLowerCase()}: {s.f}, {SPECIES[species].babyLabel.m.toLowerCase()}: {s.m}</small></div>
                  <div className="metric tone-red"><span>Пало</span><b>{s.stillborn + s.diedAfter}</b><small>мёртворожд.: {s.stillborn}, позже: {s.diedAfter}</small></div>
                </div>
                <div className="survival">
                  <div className="survival-bar"><i style={{ width: `${s.survival}%` }} /></div>
                  <span>Сохранность <b>{s.survival}%</b> ({s.alive} из {s.born})</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {mode === 'month' && (
        <>
          <div className="period-nav">
            <Button icon="back" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Предыдущий месяц" />
            <b>{fmtMonth(ym)}</b>
            <Button icon="chevron" disabled={ym >= cur} onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Следующий месяц" />
          </div>
          <MetricGrid m={metrics(evs, { species, ...monthRange(ym) })} />
        </>
      )}

      {mode === 'year' && (
        <>
          <div className="period-nav">
            <Button icon="back" onClick={() => setYear(year - 1)} aria-label="Предыдущий год" />
            <b>{year} год</b>
            <Button icon="chevron" disabled={year >= Number(cur.slice(0, 4))} onClick={() => setYear(year + 1)} aria-label="Следующий год" />
          </div>
          <YearChart evs={evs} species={species} year={year} />
          <MetricGrid m={metrics(evs, { species, from: `${year}-01-01`, to: `${year}-12-31` })} />
        </>
      )}
    </Screen>
  );
}
