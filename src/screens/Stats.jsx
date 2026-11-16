import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../lib/db.js';
import { useAnimals } from '../lib/data.js';
import { SPECIES, SPECIES_LIST, causeLabel } from '../lib/domain.js';
import { fmtMonth, fmtDate, today, MONTHS_SHORT } from '../lib/format.js';
import { useKeep } from '../lib/router.js';
import { Screen, Chips, Segmented, Button, Empty, Sheet, Field, useUi, useAction } from '../components/ui.jsx';
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
  const manual = useLiveQuery(() => db.settings.get('seasons').then((r) => r?.value || []), []);
  const [edit, setEdit] = useState(null);
  const seas = useMemo(() => (species ? seasons(evs, byId, species, manual || [], 60, today()) : []), [evs, byId, species, manual]);

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
        <>
        <Button kind="primary" icon="calendar" block onClick={() => setEdit({ species, from: today(), to: '' })}>Указать даты: {word.toLowerCase()}</Button>
        {seas.length === 0 ? (
          <Empty icon="birth" title="Рождений пока не было" text={`Когда запишете ${word.toLowerCase()}, здесь появится итог: сколько родилось и сколько сохранилось.`} />
        ) : (
          <div className="list">
            {seas.length > 1 && <Compare seas={seas} word={word} />}
            {seas.map((s) => (
              <div key={s.id ?? s.from} className="card season">
                <h2>{seasonTitle(word, s)}</h2>
                <div className="pill-note">
                  {s.manual
                    ? `${fmtDate(s.from, { year: true })} – ${s.to ? fmtDate(s.to, { year: true }) : 'ещё идёт'}`
                    : s.from === s.to ? fmtDate(s.from, { year: true }) : `${fmtDate(s.from, { year: true })} – ${fmtDate(s.to, { year: true })}`}
                  {s.mothers ? `, матерей: ${s.mothers}` : ''}
                </div>
                <div className="season-src">
                  <span className={`status ${s.manual ? 'status-active' : ''}`}>{s.manual ? 'Даты указаны вами' : 'Даты определены сами'}</span>
                  <Button size="sm" icon="edit" onClick={() => setEdit(s.manual ? { id: s.id, species, from: s.from, to: s.to || '' } : { species, from: s.from, to: s.to })}>{s.manual ? 'Изменить' : 'Уточнить'}</Button>
                </div>
                <div className="metrics">
                  <div className="metric tone-green"><span>Родилось</span><b>{s.born}</b><small>{SPECIES[species].babyLabel.f.toLowerCase()}: {s.f}, {SPECIES[species].babyLabel.m.toLowerCase()}: {s.m}</small></div>
                  <div className="metric tone-red"><span>Пало</span><b>{s.stillborn + s.diedAfter}</b><small>мёртворожд.: {s.stillborn}, позже: {s.diedAfter}</small></div>
                </div>
                <div className="season-twins">Двоен: <b>{s.twins}</b>{s.triplets ? <>, троен: <b>{s.triplets}</b></> : null}{s.mothers ? <>, в среднем <b>{(s.born / s.mothers).toFixed(1).replace('.', ',')}</b> на матку</> : null}</div>
                <div className="survival">
                  <div className="survival-bar"><i style={{ width: `${s.survival}%` }} /></div>
                  <span>Сохранность <b>{s.survival}%</b> ({s.alive} из {s.born})</span>
                </div>
              </div>
            ))}
          </div>
        )}
        </>
      )}
      {edit && <SeasonSheet edit={edit} word={word} manual={manual || []} onClose={() => setEdit(null)} />}

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

// Сравнение сезонов между годами.
function Compare({ seas, word }) {
  return (
    <div className="card compare">
      <h2>Сравнение по годам</h2>
      <div className="compare-table" role="table" aria-label={`Сравнение: ${word.toLowerCase()}`}>
        <div className="compare-row compare-head" role="row"><span>Сезон</span><span>Род.</span><span>Пало</span><span>Двоен</span><span>Сохр.</span></div>
        {seas.map((s) => (
          <div key={s.id ?? s.from} className="compare-row" role="row">
            <span>{s.from.slice(0, 4)}{seas.filter((x) => x.from.slice(0, 4) === s.from.slice(0, 4)).length > 1 ? `, ${MONTHS_SHORT[Number(s.from.slice(5, 7)) - 1]}` : ''}</span>
            <b>{s.born}</b><b>{s.stillborn + s.diedAfter}</b><b>{s.twins + s.triplets}</b><b>{s.survival}%</b>
            <i className="compare-bar"><i style={{ width: `${s.survival}%` }} /></i>
          </div>
        ))}
      </div>
    </div>
  );
}

// Даты начала и конца сезона. Конец можно не указывать, пока окот идёт.
function SeasonSheet({ edit, word, manual, onClose }) {
  const [from, setFrom] = useState(edit.from);
  const [to, setTo] = useState(edit.to || '');
  const { confirm } = useUi();
  const run = useAction();
  const bad = to && to < from;
  const save = async () => {
    const rec = { id: edit.id ?? Date.now(), species: edit.species, from, to: to || null };
    const list = [...manual.filter((m) => m.id !== rec.id), rec];
    if (await run(() => setSetting('seasons', list), 'Даты сохранены')) onClose();
  };
  const del = async () => {
    if (await confirm({ icon: 'trash', danger: true, title: 'Убрать эти даты?', text: 'Рождения никуда не денутся: сезон снова будет определяться сам.', ok: 'Убрать' })) {
      if (await run(() => setSetting('seasons', manual.filter((m) => m.id !== edit.id)), 'Даты убраны')) onClose();
    }
  };
  return (
    <Sheet open onClose={onClose} title={`${word}: даты`}>
      <p className="muted">Статистика посчитает всех, кто родился с даты начала по дату окончания.</p>
      <Field label="Начало" htmlFor="seasFrom"><input id="seasFrom" className="input" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
      <Field label="Окончание" htmlFor="seasTo" hint="Пока сезон идёт, оставьте пустым." error={bad ? 'Окончание раньше начала.' : null}>
        <input id="seasTo" className="input" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      {to && <Button onClick={() => setTo('')} icon="close">Сезон ещё идёт</Button>}
      <Button kind="primary" size="lg" block icon="check" disabled={bad || !from} onClick={save}>Сохранить</Button>
      {edit.id && <Button kind="ghost" icon="trash" onClick={del}>Убрать даты</Button>}
    </Sheet>
  );
}
