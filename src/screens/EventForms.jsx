import { useMemo, useState } from 'react';
import { db, recordOut, recordVet, recordPurchase, findTagOwner } from '../lib/db.js';
import { useAnimals } from '../lib/data.js';
import { SPECIES, DEATH_CAUSES, VET_KINDS, groupOf, causeLabel } from '../lib/domain.js';
import { today, toISO, parseISO, parseNum, heads, fmtRub } from '../lib/format.js';
import { go, back, useRoute } from '../lib/router.js';
import { Screen, Button, Field, Chips, Segmented, DateField, PickedSummary, SpeciesPicker, TagInput, useAction } from '../components/ui.jsx';
import { EventIcon } from '../components/EventItem.jsx';
import AnimalPicker from '../components/AnimalPicker.jsx';

/* ---------- Какое событие записать ---------- */
const TILES = [
  { to: '/birth', type: 'birth', title: 'Родились', sub: 'Окот, отёл, выжеребка' },
  { to: '/event/vet', type: 'vet', title: 'Ветеринар', sub: 'Прививка, лечение' },
  { to: '/sale/new', type: 'sale', title: 'Продажа', sub: 'Одно или несколько' },
  { to: '/event/purchase', type: 'purchase', title: 'Покупка', sub: 'Новые животные' },
  { to: '/event/death', type: 'death', title: 'Падёж', sub: 'С причиной' },
  { to: '/event/slaughter', type: 'slaughter', title: 'Забой', sub: 'На мясо' },
];

export function EventChooser() {
  return (
    <Screen title="Записать событие" backTo="/">
      <div className="ev-grid">
        {TILES.map((t) => (
          <button key={t.to} className="ev-tile press" onClick={() => go(t.to, { replace: true })}>
            <EventIcon type={t.type} />
            <span><b>{t.title}</b><br /><small>{t.sub}</small></span>
          </button>
        ))}
      </div>
    </Screen>
  );
}

/* ---------- Общий шаг: выбрать животных ---------- */
function useIdsFromQuery() {
  const { query } = useRoute();
  return useMemo(() => new Set((query.ids || '').split(',').map(Number).filter(Boolean)), [query.ids]);
}

function PickStep({ title, animals, selected, setSelected, onNext, hint }) {
  return (
    <Screen
      title={title}
      sub="Шаг 1: выберите животных"
      className="with-footer"
      footer={<Button kind="primary" size="lg" block icon="chevron" disabled={!selected.size} onClick={onNext}>Дальше: выбрано {selected.size}</Button>}
    >
      <AnimalPicker animals={animals} selected={selected} onChange={setSelected} hint={hint} />
    </Screen>
  );
}

/* ---------- Падёж и забой ---------- */
export function OutForm({ type }) {
  const animals = useAnimals();
  const initial = useIdsFromQuery();
  const [selected, setSelected] = useState(initial);
  const [step, setStep] = useState(initial.size ? 'details' : 'pick');
  const [date, setDate] = useState(today());
  const [cause, setCause] = useState('disease');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const run = useAction();
  const isDeath = type === 'death';
  const title = isDeath ? 'Падёж' : 'Забой';

  if (!animals) return <Screen title={title} />;
  if (step === 'pick') {
    return <PickStep title={title} animals={animals} selected={selected} setSelected={setSelected} onNext={() => setStep('details')} />;
  }
  const picked = animals.filter((a) => selected.has(a.id));

  const save = async () => {
    const ids = picked.map((a) => a.id);
    const ok = await run(
      () => recordOut(ids, { type, date, cause: isDeath ? cause : null, weight: parseNum(weight), note }),
      isDeath ? `Записан падёж: ${heads(ids.length)}` : `Записан забой: ${heads(ids.length)}`,
    );
    if (ok) back('/');
  };

  return (
    <Screen
      title={title}
      sub={picked.length > 1 ? heads(picked.length) : null}
      className="with-footer"
      footer={<Button kind={isDeath ? 'danger' : 'primary'} size="lg" block icon="check" disabled={!picked.length} onClick={save}>Записать {title.toLowerCase()}</Button>}
    >
      <div className="form">
        <PickedSummary animals={picked} onEdit={() => setStep('pick')} />
        <DateField value={date} onChange={setDate} />
        {isDeath ? (
          <Field label="Причина">
            <Segmented options={DEATH_CAUSES.map((c) => ({ value: c.key, label: c.label }))} value={cause} onChange={setCause} />
          </Field>
        ) : (
          <Field label="Вес, кг" hint="Если взвешивали. Можно оставить пустым." htmlFor="weight">
            <div className="input-unit">
              <input id="weight" className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" />
              <span>кг</span>
            </div>
          </Field>
        )}
        <Field label="Заметка" htmlFor="note">
          <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder={isDeath ? `Что случилось (${causeLabel(cause).toLowerCase()})` : 'Например: на мясо для себя'} />
        </Field>
        <p className="pill-note">Животные уйдут из поголовья, но останутся в истории. Если ошиблись, в карточке есть кнопка «Вернуть на хозяйство».</p>
      </div>
    </Screen>
  );
}

/* ---------- Ветеринария ---------- */
export function VetForm() {
  const animals = useAnimals();
  const initial = useIdsFromQuery();
  const [selected, setSelected] = useState(initial);
  const [step, setStep] = useState(initial.size ? 'details' : 'pick');
  const [date, setDate] = useState(today());
  const [kind, setKind] = useState('vaccine');
  const [drug, setDrug] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const run = useAction();

  if (!animals) return <Screen title="Ветеринар" />;
  if (step === 'pick') {
    return (
      <PickStep
        title="Ветеринар" animals={animals} selected={selected} setSelected={setSelected} onNext={() => setStep('details')}
        hint="Прививали всё стадо? Выберите вид и группу, затем «Выбрать всех»."
      />
    );
  }
  const picked = animals.filter((a) => selected.has(a.id));

  const save = async () => {
    const ok = await run(async () => {
      await recordVet(picked.map((a) => a.id), { date, kind, drug, note });
      const c = parseNum(cost);
      if (c) {
        await db.finance.add({ date, kind: 'expense', category: 'vet', amount: c, note: `${VET_KINDS.find((v) => v.key === kind)?.label}${drug ? ': ' + drug : ''}, ${heads(picked.length)}` });
      }
    }, `Записано: ${heads(picked.length)}`);
    if (ok) back('/');
  };

  return (
    <Screen
      title="Ветеринар"
      className="with-footer"
      footer={<Button kind="primary" size="lg" block icon="check" onClick={save}>Записать</Button>}
    >
      <div className="form">
        <PickedSummary animals={picked} onEdit={() => setStep('pick')} />
        <Field label="Что делали">
          <Chips options={VET_KINDS.map((v) => ({ value: v.key, label: v.label }))} value={kind} onChange={setKind} />
        </Field>
        <DateField value={date} onChange={setDate} />
        <Field label="Препарат" htmlFor="drug">
          <input id="drug" className="input" value={drug} onChange={(e) => setDrug(e.target.value)} placeholder="Название, доза" />
        </Field>
        <Field label="Стоимость, ₽" hint="Если платили. Попадёт в расходы." htmlFor="cost">
          <div className="input-unit">
            <input id="cost" className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            <span>₽</span>
          </div>
        </Field>
        <Field label="Заметка" htmlFor="note">
          <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: повторить через 21 день" />
        </Field>
      </div>
    </Screen>
  );
}

/* ---------- Покупка ---------- */
export function PurchaseForm() {
  const [species, setSpecies] = useState('sheep');
  const [group, setGroup] = useState(SPECIES.sheep.groups[0].key);
  const [rows, setRows] = useState([{ tag: '', sex: 'f' }]);
  const [date, setDate] = useState(today());
  const [seller, setSeller] = useState('');
  const [price, setPrice] = useState('');
  const [priceMode, setPriceMode] = useState('total');
  const [ageY, setAgeY] = useState('');
  const [ageM, setAgeM] = useState('');
  const [dupes, setDupes] = useState({});
  const run = useAction();
  const g = groupOf(species, group);
  const sp = SPECIES[species];

  const setCount = (n) => {
    n = Math.max(1, Math.min(200, n));
    setRows((r) => (n > r.length ? [...r, ...Array.from({ length: n - r.length }, () => ({ tag: '', sex: 'f' }))] : r.slice(0, n)));
  };
  const setRow = async (i, patch) => {
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    if ('tag' in patch) {
      const owner = await findTagOwner(species, patch.tag);
      setDupes((d) => ({ ...d, [i]: owner ? patch.tag : null }));
    }
  };

  const p = parseNum(price) || 0;
  const total = priceMode === 'total' ? p : p * rows.length;
  const hasDupes = Object.values(dupes).some(Boolean);

  const save = async () => {
    const m = (Number(ageY) || 0) * 12 + (Number(ageM) || 0);
    let birthDate = null;
    if (m) { const d = parseISO(today()); d.setMonth(d.getMonth() - m); birthDate = toISO(d); }
    const ok = await run(() => recordPurchase({
      species, group, date, seller, totalPrice: total || null,
      animals: rows.map((r) => ({ tag: r.tag, sex: g?.sex ?? r.sex, group, birthDate, birthApprox: !!birthDate })),
    }), `Куплено: ${heads(rows.length)}`);
    if (ok) go(`/animals?species=${species}`, { replace: true });
  };

  return (
    <Screen
      title="Покупка"
      className="with-footer"
      footer={<Button kind="primary" size="lg" block icon="check" disabled={hasDupes} onClick={save}>Записать покупку: {heads(rows.length)}</Button>}
    >
      <div className="form">
        <Field label="Вид"><SpeciesPicker value={species} onChange={(s) => { setSpecies(s); setGroup(SPECIES[s].groups[0].key); setDupes({}); }} /></Field>
        <Field label="Группа"><Chips options={sp.groups.map((x) => ({ value: x.key, label: x.one }))} value={group} onChange={setGroup} /></Field>
        <Field label="Сколько голов">
          <div className="stepper">
            <Button icon="minus" onClick={() => setCount(rows.length - 1)} aria-label="Меньше" />
            <b>{rows.length}</b>
            <Button icon="plus" onClick={() => setCount(rows.length + 1)} aria-label="Больше" />
          </div>
        </Field>
        <Field label="Бирки" hint="Можно оставить пустыми и присвоить позже.">
          <div className="list">
            {rows.map((r, i) => (
              <div key={i} className="buy-row">
                <span className="buy-n">{i + 1}</span>
                <TagInput id={`buyTag${i}`} value={r.tag} onChange={(v) => setRow(i, { tag: v })} />
                {g?.sex === null && (
                  <Segmented options={[{ value: 'f', label: sp.babyLabel.f, icon: 'female' }, { value: 'm', label: sp.babyLabel.m, icon: 'male' }]} value={r.sex} onChange={(v) => setRow(i, { sex: v })} />
                )}
                {dupes[i] && <div className="field-error">Бирка {dupes[i]} уже есть на хозяйстве</div>}
              </div>
            ))}
          </div>
        </Field>
        <Field label="Примерный возраст" hint="Для всех купленных сразу. Можно не указывать.">
          <div className="input-row">
            <div className="input-unit"><input id="buyY" className="input" inputMode="numeric" value={ageY} onChange={(e) => setAgeY(e.target.value.replace(/\D/g, ''))} placeholder="0" /><span>лет</span></div>
            <div className="input-unit"><input id="buyM" className="input" inputMode="numeric" value={ageM} onChange={(e) => setAgeM(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="0" /><span>мес.</span></div>
          </div>
        </Field>
        <DateField value={date} onChange={setDate} />
        <Field label="У кого купили" htmlFor="seller">
          <input id="seller" className="input" value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Имя или хозяйство" />
        </Field>
        <Field label="Цена" hint={total ? `Итого: ${fmtRub(total)}. Попадёт в расходы.` : 'Можно не указывать.'}>
          <Segmented options={[{ value: 'total', label: 'За всех' }, { value: 'head', label: 'За голову' }]} value={priceMode} onChange={setPriceMode} />
          <div className="input-unit">
            <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            <span>₽</span>
          </div>
        </Field>
      </div>
    </Screen>
  );
}
