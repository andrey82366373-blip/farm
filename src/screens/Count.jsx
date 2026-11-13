import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveCount, deleteCount } from '../lib/db.js';
import { useAnimals, herdSummary } from '../lib/data.js';
import { SPECIES, groupOf, tagCompare } from '../lib/domain.js';
import { today, fmtDate, plural } from '../lib/format.js';
import { go, back } from '../lib/router.js';
import { Screen, Button, Field, Chips, SpeciesPicker, TagInput, Segmented, Empty, Section, useUi, useAction } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import AnimalRow from '../components/AnimalRow.jsx';

// Незаконченный пересчёт хранится отдельно, чтобы не потерять счёт,
// если телефон погас или приложение закрылось.
const KEY = 'farm.countRun';
const loadRun = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const saveRun = (r) => { try { r ? localStorage.setItem(KEY, JSON.stringify(r)) : localStorage.removeItem(KEY); } catch { /* ничего */ } };

const vibrate = (p) => { try { navigator.vibrate?.(p); } catch { /* нет вибрации */ } };

function selectionTitle(species, group) {
  return group ? groupOf(species, group).many : `Все ${SPECIES[species].many.toLowerCase()}`;
}
function expectedList(animals, species, group) {
  return (animals || []).filter((a) => a.status === 'active' && a.species === species && (!group || a.group === group));
}

function verdict(counted, expected) {
  const d = expected - counted;
  if (d === 0) return { cls: 'ok', text: 'Все на месте', icon: 'check' };
  if (d > 0) return { cls: 'miss', text: `Не хватает ${d}`, icon: 'warning' };
  return { cls: 'over', text: `Больше на ${-d}. Пересчитайте`, icon: 'warning' };
}

/* ---------- Выбор, кого считать ---------- */
export function CountSetup() {
  const animals = useAnimals();
  const [species, setSpecies] = useState('sheep');
  const [group, setGroup] = useState(null);
  const run = loadRun();
  const sum = useMemo(() => herdSummary(animals), [animals]);
  if (!animals) return <Screen title="Пересчёт" />;

  const sp = sum.species[species];
  const expected = expectedList(animals, species, group).length;
  const groupOpts = [
    { value: null, label: 'Все', count: sp.n },
    ...SPECIES[species].groups.filter((g) => sp.groups[g.key]).map((g) => ({ value: g.key, label: g.many, count: sp.groups[g.key] })),
  ];
  const start = () => {
    saveRun({ species, group, n: 0, startedAt: Date.now() });
    go('/count/run', { replace: true });
  };

  return (
    <Screen
      title="Пересчёт"
      sub="Кого будем считать?"
      className="with-footer"
      right={<button className="icon-btn press" onClick={() => go('/counts')} aria-label="Прошлые пересчёты"><Icon name="calendar" /></button>}
      footer={<Button kind="primary" size="lg" block icon="tally" disabled={!expected} onClick={start}>Начать: по учёту {expected}</Button>}
    >
      {run && (
        <div className="banner">
          <Icon name="tally" />
          <div className="banner-body">
            <div className="banner-title">Есть незаконченный пересчёт</div>
            <p>{selectionTitle(run.species, run.group)}: насчитано {run.n}</p>
            <Button size="sm" kind="dark" onClick={() => go('/count/run', { replace: true })}>Продолжить</Button>
          </div>
        </div>
      )}
      <div className="form">
        <Field label="Вид"><SpeciesPicker value={species} counts={Object.fromEntries(Object.entries(sum.species).map(([k, v]) => [k, v.n]))} onChange={(s) => { setSpecies(s); setGroup(null); }} /></Field>
        {sp.n > 0 && <Field label="Группа"><Chips options={groupOpts} value={group} onChange={setGroup} /></Field>}
        {!sp.n && <p className="muted">На хозяйстве нет животных этого вида.</p>}
      </div>
    </Screen>
  );
}

/* ---------- Сам счёт ---------- */
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let alive = true;
    const req = async () => {
      try { if (document.visibilityState === 'visible' && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch { /* не страшно */ }
    };
    req();
    const onVis = () => alive && req();
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch(() => {}); };
  }, []);
}

export function CountRun() {
  const animals = useAnimals();
  const [run, setRun] = useState(loadRun);
  const [bump, setBump] = useState(0);
  const [ripples, setRipples] = useState([]);
  const bigRef = useRef();
  const { confirm } = useUi();
  useWakeLock();

  useEffect(() => { if (run) saveRun(run); }, [run]);
  useEffect(() => { if (!run) go('/count', { replace: true }); }, [run]);
  if (!run || !animals) return <div className="screen" />;

  const expected = expectedList(animals, run.species, run.group).length;
  const v = verdict(run.n, expected);

  const plus = (e) => {
    setRun((r) => ({ ...r, n: r.n + 1 }));
    setBump((b) => b + 1);
    vibrate(18);
    const rect = bigRef.current.getBoundingClientRect();
    const x = (e.clientX || rect.left + rect.width / 2) - rect.left, y = (e.clientY || rect.top + rect.height / 2) - rect.top;
    const id = Date.now() + Math.random();
    setRipples((rs) => [...rs.slice(-4), { id, x, y }]);
    setTimeout(() => setRipples((rs) => rs.filter((r) => r.id !== id)), 520);
  };
  const undo = () => {
    if (!run.n) return;
    setRun((r) => ({ ...r, n: r.n - 1 }));
    setBump((b) => b + 1);
    vibrate([30, 40, 30]);
  };
  const reset = async () => {
    if (await confirm({ icon: 'reset', danger: true, title: 'Начать счёт заново?', text: `Насчитано ${run.n}. Счёт станет 0.`, ok: 'Сбросить' })) setRun((r) => ({ ...r, n: 0 }));
  };
  const finish = () => go('/count/result', { replace: true });

  return (
    <div className="screen no-nav count-screen">
      <header className="topbar">
        <button className="topbar-back press" onClick={() => go('/count', { replace: true })} aria-label="Назад"><Icon name="back" /></button>
        <div className="topbar-title">
          <h1>{selectionTitle(run.species, run.group)}</h1>
          <div className="topbar-sub">по учёту {expected}</div>
        </div>
      </header>
      <main className="count-main">
        <div className="count-score" aria-live="polite">
          <b key={bump} className="count-n">{run.n}</b>
          <span>из {expected}</span>
        </div>
        <div className={`verdict ${v.cls}`}>{run.n === 0 ? 'Нажимайте на каждую голову' : v.text}</div>
        <button ref={bigRef} className="count-big" onClick={plus} aria-label="Плюс одна голова">
          {ripples.map((r) => <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />)}
          <span className="count-big-inner">+1</span>
        </button>
        <div className="btn-row">
          <Button icon="undo" size="lg" onClick={undo} disabled={!run.n}>Отменить</Button>
          <Button icon="reset" size="lg" onClick={reset} disabled={!run.n}>Сброс</Button>
        </div>
        <Button kind="dark" size="lg" block icon="check" onClick={finish}>Готово, сравнить</Button>
      </main>
    </div>
  );
}

/* ---------- Итог и «кого видел» ---------- */
export function CountResult() {
  const animals = useAnimals();
  const [run] = useState(loadRun);
  const [marking, setMarking] = useState(false);
  const [seen, setSeen] = useState(() => new Set());
  const [tab, setTab] = useState('unseen');
  const [tag, setTag] = useState('');
  const [msg, setMsg] = useState(null);
  const act = useAction();

  useEffect(() => { if (!run) go('/count', { replace: true }); }, [run]);
  const list = useMemo(() => (run ? expectedList(animals, run.species, run.group).sort(tagCompare) : []), [animals, run]);
  if (!run || !animals) return <div className="screen" />;

  const expected = list.length;
  const v = verdict(run.n, expected);
  const unseen = list.filter((a) => !seen.has(a.id));
  const shown = tab === 'unseen' ? unseen : list.filter((a) => seen.has(a.id));

  const toggle = (id) => { const s = new Set(seen); s.has(id) ? s.delete(id) : s.add(id); setSeen(s); };
  const mark = () => {
    if (!tag) return;
    const a = list.find((x) => x.tag === tag);
    if (!a) setMsg({ bad: true, text: `Бирки ${tag} нет в этой группе` });
    else if (seen.has(a.id)) setMsg({ bad: false, text: `${tag} уже отмечена` });
    else { toggle(a.id); vibrate(15); setMsg({ bad: false, text: `${tag}: видел` }); }
    setTag('');
  };

  const save = async () => {
    const rec = {
      date: today(), at: Date.now(), species: run.species, group: run.group, expected, counted: run.n,
      marked: marking, seenIds: marking ? [...seen] : [], missingIds: marking ? unseen.map((a) => a.id) : [],
    };
    const id = await act(() => saveCount(rec), 'Пересчёт сохранён');
    if (id) { saveRun(null); go(`/count/${id}`, { replace: true }); }
  };

  return (
    <Screen
      title="Итог пересчёта"
      sub={selectionTitle(run.species, run.group)}
      backTo="/count/run"
      className="with-footer"
      footer={<Button kind="primary" size="lg" block icon="check" onClick={save}>Сохранить пересчёт</Button>}
    >
      <div className={`card result result-${v.cls}`}>
        <div className="result-nums">
          <div><span>Насчитали</span><b>{run.n}</b></div>
          <div><span>По учёту</span><b>{expected}</b></div>
        </div>
        <div className={`verdict big ${v.cls}`}><Icon name={v.icon} />{v.text}</div>
      </div>
      {v.cls !== 'ok' && (
        <Button icon="tally" block onClick={() => go('/count/run', { replace: true })}>Вернуться и досчитать</Button>
      )}

      {v.cls === 'miss' && !marking && (
        <div className="card">
          <p>Чтобы понять, кого нет, отметьте по биркам тех, кого видели. Остальные окажутся в списке «Не видел».</p>
          <Button kind="tag" icon="eye" block onClick={() => setMarking(true)} style={{ marginTop: 12 }}>Отметить, кого видел</Button>
        </div>
      )}

      {marking && (
        <Section title={`Видел: ${seen.size} из ${expected}`}>
          <div className="picker-tag">
            <TagInput id="seenTag" value={tag} onChange={(x) => { setTag(x); setMsg(null); }} onEnter={mark} placeholder="Номер бирки" autoFocus />
            <Button kind="dark" icon="check" onClick={mark} disabled={!tag}>Видел</Button>
          </div>
          {msg && <div className={`picker-msg ${msg.bad ? 'bad' : ''}`}><Icon name={msg.bad ? 'warning' : 'check'} />{msg.text}</div>}
          <Segmented options={[{ value: 'unseen', label: `Не видел: ${unseen.length}` }, { value: 'seen', label: `Видел: ${seen.size}` }]} value={tab} onChange={setTab} />
          <div className="list">
            {shown.map((a) => <AnimalRow key={a.id} a={a} selectable selected={seen.has(a.id)} showSpecies={false} onClick={() => toggle(a.id)} />)}
          </div>
          {shown.length === 0 && <p className="muted center">{tab === 'unseen' ? 'Всех отметили.' : 'Пока никого не отметили.'}</p>}
        </Section>
      )}
    </Screen>
  );
}

/* ---------- Сохранённый пересчёт ---------- */
export function CountView({ id }) {
  const c = useLiveQuery(() => db.counts.get(id), [id]);
  const missing = useLiveQuery(() => (c?.missingIds?.length ? db.animals.bulkGet(c.missingIds) : []), [c]);
  const { confirm } = useUi();
  const act = useAction();
  if (c === undefined) return <Screen title="Пересчёт" />;
  if (!c) return <Screen title="Пересчёт" backTo="/counts"><Empty icon="tally" title="Пересчёт не найден" /></Screen>;
  const v = verdict(c.counted, c.expected);
  const del = async () => {
    if (await confirm({ icon: 'trash', danger: true, title: 'Удалить этот пересчёт?', ok: 'Удалить' })) {
      if (await act(() => deleteCount(id), 'Пересчёт удалён')) back('/counts');
    }
  };
  return (
    <Screen title="Пересчёт" sub={`${selectionTitle(c.species, c.group)}, ${fmtDate(c.date, { year: true })}`} backTo="/counts">
      <div className={`card result result-${v.cls}`}>
        <div className="result-nums">
          <div><span>Насчитали</span><b>{c.counted}</b></div>
          <div><span>По учёту</span><b>{c.expected}</b></div>
        </div>
        <div className={`verdict big ${v.cls}`}><Icon name={v.icon} />{v.text}</div>
      </div>
      {c.marked && (missing?.length ? (
        <Section title={`Не видел: ${missing.length}`}>
          <p className="muted">Этих животных не отметили при пересчёте. Проверьте, где они.</p>
          <div className="list">
            {missing.filter(Boolean).map((a) => <AnimalRow key={a.id} a={a} showSpecies={false} onClick={() => go(`/animal/${a.id}`)} />)}
          </div>
        </Section>
      ) : <p className="muted">Отметили всех: видели {c.seenIds.length}.</p>)}
      <Button kind="primary" icon="tally" block onClick={() => go('/count')}>Новый пересчёт</Button>
      <Button kind="ghost" icon="trash" onClick={del}>Удалить пересчёт</Button>
    </Screen>
  );
}

/* ---------- Прошлые пересчёты ---------- */
export function Counts() {
  const counts = useLiveQuery(() => db.counts.orderBy('date').reverse().toArray(), []);
  return (
    <Screen
      title="Пересчёты"
      backTo="/more"
      right={<button className="icon-btn press" onClick={() => go('/count')} aria-label="Новый пересчёт"><Icon name="plus" /></button>}
    >
      {counts && counts.length === 0 && (
        <Empty icon="tally" title="Пересчётов ещё не было" text="Посчитайте стадо в поле, и результат сохранится здесь с датой.">
          <Button kind="primary" icon="tally" onClick={() => go('/count')}>Начать пересчёт</Button>
        </Empty>
      )}
      <div className="list">
        {(counts || []).sort((a, b) => (b.at || 0) - (a.at || 0)).map((c) => {
          const v = verdict(c.counted, c.expected);
          return (
            <button key={c.id} className="row press" onClick={() => go(`/count/${c.id}`)}>
              <span className={`count-dot ${v.cls}`}><Icon name={v.icon} /></span>
              <span className="row-main">
                <span className="row-title">{selectionTitle(c.species, c.group)}: {c.counted} из {c.expected}</span>
                <span className="row-sub">{fmtDate(c.date)}, {v.text.toLowerCase()}{c.missingIds?.length ? `, не видел ${c.missingIds.length} ${plural(c.missingIds.length, 'голову', 'головы', 'голов')}` : ''}</span>
              </span>
              <Icon name="chevron" />
            </button>
          );
        })}
      </div>
      {counts && counts.length > 0 && <p className="pill-note center">Всего: {counts.length} {plural(counts.length, 'пересчёт', 'пересчёта', 'пересчётов')}</p>}
    </Screen>
  );
}
