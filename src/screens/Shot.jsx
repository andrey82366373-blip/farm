import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, recordVet, setSetting } from '../lib/db.js';
import { useAnimals, matchesExactly } from '../lib/data.js';
import { SPECIES, SPECIES_LIST, VET_KINDS, groupOf, tagCompare } from '../lib/domain.js';
import { today, addDays, fmtDate, heads, parseNum, plural } from '../lib/format.js';
import { drugSuggestions, drugSummary } from '../lib/shots.js';
import { go, back, useRoute } from '../lib/router.js';
import { Screen, Button, Field, Chips, Segmented, DateField, Section, Empty, useUi, useAction } from '../components/ui.jsx';
import AnimalRow from '../components/AnimalRow.jsx';
import Icon from '../components/Icon.jsx';

// Начатый укол хранится отдельно: если телефон погас посреди работы,
// отмеченные животные не потеряются.
const KEY = 'farm.shotDraft';
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const saveDraft = (d) => { try { d ? localStorage.setItem(KEY, JSON.stringify(d)) : localStorage.removeItem(KEY); } catch { /* ничего */ } };
const vibrate = (p) => { try { navigator.vibrate?.(p); } catch { /* нет вибрации */ } };

const blank = () => ({ drug: '', kind: 'vaccine', date: today(), dose: '', note: '', nextDate: '', cost: '', species: null, group: null, ids: [], targetIds: null });
const idsOf = (s) => (s || '').split(',').map(Number).filter(Boolean);

function initial(query) {
  if (query.ids || query.target || query.drug) {
    return { ...blank(), drug: query.drug || '', dose: query.dose || '', kind: query.kind || 'vaccine', ids: idsOf(query.ids), targetIds: query.target ? idsOf(query.target) : null };
  }
  const d = loadDraft();
  return d && d.ids?.length ? { ...blank(), ...d, resumed: true } : blank();
}

const NEXT = [
  { label: 'Не нужен', days: null },
  { label: 'Через 2 недели', days: 14 },
  { label: 'Через 3 недели', days: 21 },
  { label: 'Через месяц', days: 30 },
  { label: 'Через полгода', days: 182 },
  { label: 'Через год', days: 365 },
];

/* ---------- Укол / прививка ---------- */
export function ShotForm() {
  const { query } = useRoute();
  const animals = useAnimals();
  const vet = useLiveQuery(() => db.events.where('type').equals('vet').toArray(), []);
  const [d, setD] = useState(() => initial(query));
  const [num, setNum] = useState('');
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState('left');
  const [limit, setLimit] = useState(60);
  const numRef = useRef();
  const run = useAction();
  const { confirm } = useUi();

  useEffect(() => { saveDraft(d.ids.length ? d : null); }, [d]);
  const set = (patch) => setD((x) => ({ ...x, ...patch }));

  const pool = useMemo(() => (animals || []).filter((a) => a.status === 'active'), [animals]);
  const target = useMemo(() => {
    if (d.targetIds) { const s = new Set(d.targetIds); return pool.filter((a) => s.has(a.id)).sort(tagCompare); }
    if (!d.species) return [];
    return pool.filter((a) => a.species === d.species && (!d.group || a.group === d.group)).sort(tagCompare);
  }, [pool, d.targetIds, d.species, d.group]);
  const suggestions = useMemo(() => drugSuggestions(vet), [vet]);

  if (!animals || !vet) return <Screen title="Укол, прививка" />;

  const done = new Set(d.ids);
  const doneInTarget = target.filter((a) => done.has(a.id)).length;
  const left = target.length - doneInTarget;
  const hasTarget = target.length > 0;
  const targetName = d.targetIds ? 'по напоминанию' : d.species ? (d.group ? groupOf(d.species, d.group).many.toLowerCase() : SPECIES[d.species].many.toLowerCase()) : '';

  const toggle = (id) => set({ ids: done.has(id) ? d.ids.filter((x) => x !== id) : [...d.ids, id] });
  const addByNumber = () => {
    const q = num.trim();
    if (!q) return;
    const scope = hasTarget ? target : pool;
    let hits = scope.filter((a) => matchesExactly(a, q));
    if (!hits.length && hasTarget) hits = pool.filter((a) => matchesExactly(a, q));
    if (hits.length === 0) { setMsg({ bad: true, text: `Номера ${q} нет на хозяйстве` }); vibrate([40, 60, 40]); }
    else if (hits.length > 1) setMsg({ bad: true, text: `${q} есть у разных животных. Выберите вид ниже.` });
    else if (done.has(hits[0].id)) setMsg({ bad: false, text: `${q} уже отмечен` });
    else { toggle(hits[0].id); setMsg({ bad: false, text: `${q}: поставлено` }); vibrate(18); }
    setNum('');
    numRef.current?.focus();
  };
  const wholeGroup = () => set({ ids: [...new Set([...d.ids, ...target.map((a) => a.id)])] });
  const clearGroup = () => { const t = new Set(target.map((a) => a.id)); set({ ids: d.ids.filter((id) => !t.has(id)) }); };

  const pickDrug = (s) => set({ drug: s.name, dose: d.dose || s.dose, kind: s.kind || d.kind });
  const shownSuggestions = suggestions.filter((s) => s.name.toLowerCase() !== d.drug.trim().toLowerCase() && s.name.toLowerCase().includes(d.drug.trim().toLowerCase())).slice(0, 6);

  const save = async () => {
    const ok = await run(async () => {
      await recordVet(d.ids, { date: d.date, kind: d.kind, drug: d.drug, dose: d.dose, note: d.note, nextDate: d.nextDate || null });
      const c = parseNum(d.cost);
      if (c) await db.finance.add({ date: d.date, kind: 'expense', category: 'vet', amount: c, note: `${d.drug || 'Ветеринар'}, ${heads(d.ids.length)}` });
    }, `Записано: ${heads(d.ids.length)}`);
    if (ok) { saveDraft(null); back('/'); }
  };
  const restart = async () => {
    if (await confirm({ icon: 'reset', danger: true, title: 'Начать заново?', text: `Отметки (${d.ids.length}) сбросятся.`, ok: 'Сбросить' })) { saveDraft(null); setD(blank()); }
  };

  const list = hasTarget ? target.filter((a) => (tab === 'left' ? !done.has(a.id) : done.has(a.id))) : pool.filter((a) => done.has(a.id)).sort(tagCompare);
  const spOpts = SPECIES_LIST.map((s) => ({ value: s.key, label: s.many, icon: s.icon, count: pool.filter((a) => a.species === s.key).length })).filter((o) => o.count);
  const grOpts = d.species
    ? [{ value: null, label: 'Все' }, ...SPECIES[d.species].groups.map((g) => ({ value: g.key, label: g.many, count: pool.filter((a) => a.species === d.species && a.group === g.key).length })).filter((g) => g.count)]
    : [];

  return (
    <Screen
      title="Укол, прививка"
      className="with-footer"
      right={d.ids.length > 0 ? <button className="icon-btn press" onClick={restart} aria-label="Начать заново"><Icon name="reset" /></button> : null}
      footer={<Button kind="primary" size="lg" block icon="check" disabled={!d.ids.length} onClick={save}>Записать: {heads(d.ids.length)}</Button>}
    >
      <div className="shot-counter" aria-live="polite">
        <div className="shot-nums">
          <div><span>Поставлено</span><b>{d.ids.length}</b></div>
          {hasTarget && <div className={left === 0 ? 'ok' : ''}><span>Осталось</span><b>{left}</b></div>}
        </div>
        {hasTarget && (
          <>
            <div className="shot-bar"><i style={{ width: `${(doneInTarget / target.length) * 100}%` }} /></div>
            <div className="shot-sub">{left === 0 ? `Вся группа готова: ${targetName}, ${target.length}` : `Группа: ${targetName}, всего ${target.length}`}</div>
          </>
        )}
        {!hasTarget && <div className="shot-sub">Выберите группу ниже, чтобы видеть, сколько осталось</div>}
      </div>
      {d.resumed && <p className="pill-note">Продолжаем начатый укол: отметки сохранились.</p>}

      <div className="form">
        <Field label="Препарат" htmlFor="drug">
          <input id="drug" className="input" value={d.drug} onChange={(e) => set({ drug: e.target.value })} placeholder="Название" autoComplete="off" />
          {shownSuggestions.length > 0 && (
            <div className="chips">
              {shownSuggestions.map((s) => <button key={s.name} className="chip press" onClick={() => pickDrug(s)}>{s.name}</button>)}
            </div>
          )}
        </Field>
        <Field label="Что это">
          <Chips options={VET_KINDS.map((v) => ({ value: v.key, label: v.label }))} value={d.kind} onChange={(v) => set({ kind: v })} />
        </Field>
        <DateField value={d.date} onChange={(v) => set({ date: v })} />

        <Section title="Кому ставим">
          {!d.targetIds && (
            <>
              <Chips wrap={false} options={spOpts} value={d.species} onChange={(v) => { set({ species: v === d.species ? null : v, group: null }); setTab('left'); }} />
              {d.species && grOpts.length > 2 && <Chips wrap={false} options={grOpts} value={d.group} onChange={(v) => set({ group: v })} />}
            </>
          )}
          <div className="picker-tag">
            <input
              ref={numRef} id="shotNum" className="input input-tag" autoComplete="off" enterKeyHint="done"
              placeholder="Номер" value={num}
              onChange={(e) => { setNum(e.target.value); setMsg(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') addByNumber(); }}
            />
            <Button kind="dark" icon="check" onClick={addByNumber} disabled={!num.trim()}>Поставил</Button>
          </div>
          {msg && <div className={`picker-msg ${msg.bad ? 'bad' : ''}`}><Icon name={msg.bad ? 'warning' : 'check'} />{msg.text}</div>}
          <p className="pill-note">Вводите номер и нажимайте «Поставил». Сканер бирок, который печатает номер сам, тоже подойдёт.</p>

          {hasTarget && (
            <>
              {left > 0
                ? <Button kind="tag" size="lg" block icon="check" onClick={wholeGroup}>Вся группа сразу ({target.length})</Button>
                : <Button block icon="close" onClick={clearGroup}>Снять отметки с группы</Button>}
              <Segmented options={[{ value: 'left', label: `Осталось: ${left}` }, { value: 'done', label: `Поставлено: ${doneInTarget}` }]} value={tab} onChange={(v) => { setTab(v); setLimit(60); }} />
            </>
          )}
          <div className="list">
            {list.slice(0, limit).map((a) => <AnimalRow key={a.id} a={a} selectable selected={done.has(a.id)} showSpecies={!d.species} onClick={() => toggle(a.id)} />)}
          </div>
          {list.length > limit && <Button block onClick={() => setLimit(limit + 100)}>Показать ещё ({list.length - limit})</Button>}
          {hasTarget && list.length === 0 && <p className="muted center">{tab === 'left' ? 'Никого не осталось.' : 'Пока никому не поставили.'}</p>}
        </Section>

        <Field label="Доза" htmlFor="dose" hint="Необязательно.">
          <input id="dose" className="input" value={d.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="Например: 2 мл" />
        </Field>
        <Field label="Следующий укол" hint={d.nextDate ? `Напомню ${fmtDate(d.nextDate, { year: true })} на главном экране.` : 'Если нужен повтор, приложение напомнит.'}>
          <div className="chips">
            {NEXT.map((n) => {
              const v = n.days ? addDays(d.date, n.days) : '';
              return <button key={n.label} className={`chip press ${d.nextDate === v ? 'on' : ''}`} onClick={() => set({ nextDate: v })}>{n.label}</button>;
            })}
          </div>
          <input id="nextDate" className="input" type="date" min={d.date} value={d.nextDate} onChange={(e) => set({ nextDate: e.target.value })} aria-label="Дата следующего укола" />
        </Field>
        <Field label="Заметка" htmlFor="shotNote" hint="Необязательно.">
          <textarea id="shotNote" className="textarea" value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="Например: в холку, реакции не было" />
        </Field>
        <Field label="Стоимость, ₽" htmlFor="shotCost" hint="Если платили. Попадёт в расходы.">
          <div className="input-unit"><input id="shotCost" className="input" inputMode="decimal" value={d.cost} onChange={(e) => set({ cost: e.target.value })} placeholder="0" /><span>₽</span></div>
        </Field>
      </div>
    </Screen>
  );
}

/* ---------- Сводка по препаратам ---------- */
export function Shots() {
  const animals = useAnimals();
  const vet = useLiveQuery(() => db.events.where('type').equals('vet').toArray(), []);
  const [open, setOpen] = useState(null);
  const byId = useMemo(() => new Map((animals || []).map((a) => [a.id, a])), [animals]);
  const drugs = useMemo(() => drugSummary(vet, byId), [vet, byId]);
  if (!animals || !vet) return <Screen title="Уколы и прививки" />;

  return (
    <Screen title="Уколы и прививки" sub="Когда и скольким ставили" backTo="/journal">
      <Button kind="primary" size="lg" icon="vet" block onClick={() => go('/event/vet')}>Записать укол</Button>
      {drugs.length === 0 && <Empty icon="vet" title="Уколов пока не было" text="После первой записи здесь появится сводка по каждому препарату." />}
      {drugs.map((d) => {
        const last = d.sessions[0];
        const isOpen = open === d.key;
        return (
          <div key={d.key} className="card drug">
            <button className="drug-head press" onClick={() => setOpen(isOpen ? null : d.key)} aria-expanded={isOpen}>
              <span className="ev-ico tone-sky"><Icon name="vet" /></span>
              <span className="row-main">
                <span className="row-title">{d.name}</span>
                <span className="row-sub">последний раз {fmtDate(last.date, { year: true })}, {heads(last.ids.length)}</span>
                <span className="row-sub">всего ставили {d.sessions.length} {plural(d.sessions.length, 'раз', 'раза', 'раз')}, {heads(d.heads)}</span>
              </span>
              <Icon name="chevron" className={isOpen ? 'rot' : ''} />
            </button>
            {isOpen && (
              <div className="drug-list">
                {d.sessions.map((s) => (
                  <div key={s.date} className="drug-row">
                    <b>{fmtDate(s.date, { year: true })}</b>
                    <span>{heads(s.ids.length)}: {Object.entries(s.species).map(([k, n]) => `${SPECIES[k].many.toLowerCase()} ${n}`).join(', ')}</span>
                    {(s.dose || s.nextDate) && <small>{[s.dose ? `доза ${s.dose}` : null, s.nextDate ? `повтор ${fmtDate(s.nextDate, { year: true })}` : null].filter(Boolean).join(', ')}</small>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Screen>
  );
}

// Убрать напоминание о повторном уколе.
export async function dismissShotReminder(key) {
  const list = (await db.settings.get('shotDismissed'))?.value || [];
  await setSetting('shotDismissed', [...list, key]);
}
