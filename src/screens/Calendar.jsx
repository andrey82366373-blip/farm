import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, recordMating, setSetting } from '../lib/db.js';
import { useAnimals } from '../lib/data.js';
import { SPECIES, SPECIES_LIST, GESTATION_DEFAULT, isBreeding } from '../lib/domain.js';
import { today, fmtDate, fmtMonth, addDays, daysBetween, plural, heads } from '../lib/format.js';
import { useGestation, useMatingEvents, pregnancies } from '../lib/repro.js';
import { go, back } from '../lib/router.js';
import { Screen, Button, Field, DateField, PickedSummary, TagInput, Segmented, Section, Empty, Tag, useUi, useAction } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { PickStep, useIdsFromQuery } from './EventForms.jsx';

const dayWord = (n) => plural(n, 'день', 'дня', 'дней');

/* ---------- Отметить покрытие ---------- */
export function MatingForm() {
  const animals = useAnimals();
  const gestation = useGestation();
  const initial = useIdsFromQuery();
  const [selected, setSelected] = useState(initial);
  const [step, setStep] = useState(initial.size ? 'details' : 'pick');
  const [date, setDate] = useState(today());
  const [sire, setSire] = useState('');
  const [note, setNote] = useState('');
  const [toNetel, setToNetel] = useState(true);
  const run = useAction();
  const females = useMemo(() => (animals || []).filter((a) => a.status === 'active' && isBreeding(a)), [animals]);

  if (!animals) return <Screen title="Покрытие" />;
  if (step === 'pick') {
    return (
      <PickStep
        title="Покрытие" animals={females} selected={selected} setSelected={setSelected} onNext={() => setStep('details')}
        hint="Отметьте самок. Пустили барана ко всем овцематкам? Выберите «Овцы», группу и «Выбрать всех»."
      />
    );
  }
  const picked = animals.filter((a) => selected.has(a.id));
  const kinds = [...new Set(picked.map((a) => a.species))];
  const heifers = picked.filter((a) => a.species === 'cow' && a.group === 'heifer').length;

  const save = async () => {
    const ok = await run(() => recordMating(picked.map((a) => a.id), { date, sire, note, toNetel: heifers > 0 && toNetel }), `Записано покрытие: ${heads(picked.length)}`);
    if (ok) back('/calendar');
  };

  return (
    <Screen title="Покрытие" sub="Случка, осеменение" className="with-footer" footer={<Button kind="primary" size="lg" block icon="check" onClick={save}>Записать</Button>}>
      <div className="form">
        <PickedSummary animals={picked} onEdit={() => setStep('pick')} />
        <DateField label="Дата покрытия" value={date} onChange={setDate} />
        <div className="card due-preview">
          {kinds.map((k) => (
            <div key={k} className="due-line">
              <span>{SPECIES[k].birthWord} ожидается</span>
              <b>{fmtDate(addDays(date, gestation[k]), { year: true })}</b>
              <small>через {gestation[k]} {dayWord(gestation[k])} после покрытия</small>
            </div>
          ))}
        </div>
        <Field label="Самец (номер бирки)" hint="Если важно, от кого. Можно не указывать." htmlFor="sire">
          <TagInput id="sire" value={sire} onChange={setSire} placeholder="Бирка самца" />
        </Field>
        {heifers > 0 && (
          <Field label={`Тёлок среди выбранных: ${heifers}. Перевести их в нетели?`}>
            <Segmented options={[{ value: true, label: 'Да, в нетели' }, { value: false, label: 'Нет' }]} value={toNetel} onChange={setToNetel} />
          </Field>
        )}
        <Field label="Заметка" htmlFor="note">
          <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: искусственное осеменение" />
        </Field>
      </div>
    </Screen>
  );
}

/* ---------- Счётчик дней ---------- */
function daysText(date) {
  const n = daysBetween(date, today());
  if (n === 0) return { big: '0', small: 'это сегодня' };
  if (n > 0) return { big: String(n), small: `${dayWord(n)} прошло${n >= 60 ? `, это ≈ ${Math.floor(n / 30.4)} мес.` : n >= 14 ? `, это ${Math.floor(n / 7)} нед.` : ''}` };
  return { big: String(-n), small: `${dayWord(-n)} осталось` };
}

function DayCounters() {
  const counters = useLiveQuery(() => db.settings.get('counters').then((r) => r?.value || []), []);
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState(false);
  const { confirm } = useUi();
  const run = useAction();

  const add = async () => {
    const list = [...(counters || []), { id: Date.now(), name: name.trim() || 'Без названия', date }];
    if (await run(() => setSetting('counters', list), 'Счётчик добавлен')) { setName(''); setDate(today()); setAdding(false); }
  };
  const remove = async (c) => {
    if (await confirm({ icon: 'trash', danger: true, title: `Удалить счётчик «${c.name}»?`, ok: 'Удалить' })) {
      await run(() => setSetting('counters', counters.filter((x) => x.id !== c.id)));
    }
  };
  const preview = daysText(date);

  return (
    <Section title="Счётчик дней" action={!adding && <Button size="sm" icon="plus" onClick={() => setAdding(true)}>Добавить</Button>}>
      {(counters || []).length === 0 && !adding && <p className="muted">Например: «Барана пустили к овцам» или «Купили сено». Приложение посчитает, сколько дней прошло.</p>}
      <div className="list">
        {(counters || []).map((c) => {
          const t = daysText(c.date);
          return (
            <div key={c.id} className="card counter">
              <div className="counter-n">{t.big}</div>
              <div className="row-main">
                <span className="row-title">{c.name}</span>
                <span className="row-sub">{t.small}, с {fmtDate(c.date, { year: true })}</span>
              </div>
              <button className="ev-del press" onClick={() => remove(c)} aria-label="Удалить счётчик"><Icon name="trash" /></button>
            </div>
          );
        })}
      </div>
      {adding && (
        <div className="card form">
          <Field label="Название" htmlFor="cName"><input id="cName" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Что случилось" autoFocus /></Field>
          <Field label="Дата" htmlFor="cDate"><input id="cDate" className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
          <div className="counter-preview"><b>{preview.big}</b> {preview.small}</div>
          <div className="btn-row">
            <Button onClick={() => setAdding(false)}>Отмена</Button>
            <Button kind="primary" icon="check" onClick={add}>Сохранить</Button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ---------- Календарь ---------- */
export function Calendar() {
  const animals = useAnimals();
  const events = useMatingEvents();
  const gestation = useGestation();
  const preg = useMemo(() => pregnancies(animals, events, gestation), [animals, events, gestation]);

  const months = useMemo(() => {
    const list = [...preg.values()].sort((a, b) => (a.due < b.due ? -1 : 1));
    const out = [];
    for (const p of list) {
      const ym = p.due.slice(0, 7);
      if (!out.length || out[out.length - 1].ym !== ym) out.push({ ym, items: [] });
      out[out.length - 1].items.push(p);
    }
    return out;
  }, [preg]);

  return (
    <Screen title="Календарь" sub="Сроки и счётчики" backTo="/more" right={<button className="icon-btn press" onClick={() => go('/settings')} aria-label="Настройки сроков"><Icon name="settings" /></button>}>
      <Button kind="primary" size="lg" icon="heart" block onClick={() => go('/event/mating')}>Отметить покрытие</Button>

      <Section title="Ожидаемые роды">
        {animals && events && months.length === 0 && (
          <Empty icon="heart" title="Пока никого не ждём" text="Отметьте дату случки или покрытия, и здесь появится ожидаемая дата окота, отёла или выжеребки." />
        )}
        {months.map((m) => (
          <div key={m.ym} className="section">
            <div className="section-head"><h2 className="h3">{fmtMonth(m.ym)}</h2><span className="muted">{m.items.length}</span></div>
            <div className="list">
              {groupSameDay(m.items).map((g) => (g.length > 2 ? <DueGroup key={`${g[0].animal.species}${g[0].due}`} items={g} /> : g.map((p) => <DueRow key={p.animal.id} p={p} />)))}
            </div>
          </div>
        ))}
      </Section>

      <DayCounters />
      <p className="pill-note">Сроки: овцы {gestation.sheep}, коровы {gestation.cow}, лошади {gestation.horse} {dayWord(gestation.horse)}. Поменять можно в настройках.</p>
    </Screen>
  );
}

// Много самок с одной датой (пустили барана ко всем сразу) — одна карточка.
function groupSameDay(items) {
  const out = [];
  for (const p of items) {
    const last = out[out.length - 1];
    if (last && last[0].due === p.due && last[0].animal.species === p.animal.species) last.push(p);
    else out.push([p]);
  }
  return out;
}

function DueGroup({ items }) {
  const p = items[0];
  const sp = SPECIES[p.animal.species];
  return (
    <div className="card due-group">
      <div className="due-group-head">
        <span className="row-main">
          <span className="row-title">{sp.birthWord}: {fmtDate(p.due, { year: true })}</span>
          <span className="row-sub">{heads(items.length)}, {p.daysLeft < 0 ? `срок прошёл ${-p.daysLeft} ${dayWord(-p.daysLeft)} назад` : `через ${p.daysLeft} ${dayWord(p.daysLeft)}`}</span>
        </span>
        <span className={`due-badge ${p.daysLeft < 0 ? 'late' : p.daysLeft <= 7 ? 'soon' : ''}`}>{p.daysLeft < 0 ? '!' : p.daysLeft}</span>
      </div>
      <div className="picked-tags">
        {items.map((x) => (
          <button key={x.animal.id} className="press tag-btn" onClick={() => go(`/animal/${x.animal.id}`)} aria-label={`Открыть ${x.animal.tag}`}>
            <Tag tag={x.animal.tag} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function DueRow({ p }) {
  const a = p.animal;
  const late = p.daysLeft < 0;
  return (
    <button className="row press" onClick={() => go(`/animal/${a.id}`)}>
      <Tag tag={a.tag} />
      <span className="row-main">
        <span className="row-title">{SPECIES[a.species].birthWord}: {fmtDate(p.due)}</span>
        <span className="row-sub">{late ? `срок прошёл ${-p.daysLeft} ${dayWord(-p.daysLeft)} назад, проверьте` : p.daysLeft === 0 ? 'сегодня' : `через ${p.daysLeft} ${dayWord(p.daysLeft)}`}</span>
      </span>
      <span className={`due-badge ${late ? 'late' : p.daysLeft <= 7 ? 'soon' : ''}`}>{late ? '!' : p.daysLeft}</span>
    </button>
  );
}

/* ---------- Блок беременности в карточке самки ---------- */
export function PregnancyBlock({ animal, p, onFailed }) {
  const sp = SPECIES[animal.species];
  if (!p) {
    return (
      <Button icon="heart" block onClick={() => go(`/event/mating?ids=${animal.id}`)}>Отметить {sp.matingWord.toLowerCase()}</Button>
    );
  }
  const late = p.daysLeft < 0;
  return (
    <div className={`card preg ${late ? 'late' : ''}`}>
      <div className="preg-head">
        <Icon name="heart" />
        <div className="row-main">
          <span className="row-title">{sp.birthWord} ожидается {fmtDate(p.due, { year: true })}</span>
          <span className="row-sub">
            {late ? `Срок прошёл ${-p.daysLeft} ${dayWord(-p.daysLeft)} назад` : p.daysLeft === 0 ? 'Сегодня' : `Через ${p.daysLeft} ${dayWord(p.daysLeft)}`}
            {`. ${sp.matingWord}: ${fmtDate(p.mating.date)}`}{p.mating.data?.sire ? `, самец ${p.mating.data.sire}` : ''}
          </span>
        </div>
      </div>
      <div className="survival-bar preg-bar"><i style={{ width: `${Math.round(p.progress * 100)}%` }} /></div>
      <div className="btn-row">
        <Button size="sm" icon="birth" onClick={() => go(`/birth?species=${animal.species}&mother=${animal.tag}`)}>Родила</Button>
        <Button size="sm" icon="close" onClick={onFailed}>Пустая</Button>
      </div>
    </div>
  );
}

/* ---------- Настройки ---------- */
export function Settings() {
  const gestation = useGestation();
  const [vals, setVals] = useState(null);
  const run = useAction();
  const v = vals ?? gestation;
  const changed = SPECIES_LIST.some((s) => Number(v[s.key]) !== gestation[s.key]);

  const save = async () => {
    const clean = Object.fromEntries(SPECIES_LIST.map((s) => [s.key, Math.max(30, Math.min(400, Number(v[s.key]) || GESTATION_DEFAULT[s.key]))]));
    if (await run(() => setSetting('gestation', clean), 'Сроки сохранены')) setVals(null);
  };

  return (
    <Screen title="Настройки" backTo="/more" className={changed ? 'with-footer' : ''} footer={changed ? <Button kind="primary" size="lg" block icon="check" onClick={save}>Сохранить</Button> : null}>
      <Section title="Срок беременности, дней">
        <p className="muted">По этим числам считается ожидаемая дата родов после покрытия.</p>
        {SPECIES_LIST.map((s) => (
          <Field key={s.key} label={`${s.many}: ${s.birthWord.toLowerCase()}`} htmlFor={`g-${s.key}`} hint={`Обычно около ${GESTATION_DEFAULT[s.key]}`}>
            <div className="input-unit">
              <input id={`g-${s.key}`} className="input" inputMode="numeric" value={v[s.key]} onChange={(e) => setVals({ ...v, [s.key]: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
              <span>дн.</span>
            </div>
          </Field>
        ))}
        <Button kind="ghost" onClick={() => setVals({ ...GESTATION_DEFAULT })}>Вернуть обычные сроки</Button>
      </Section>
    </Screen>
  );
}
