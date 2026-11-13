import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../lib/db.js';
import { useAnimals } from '../lib/data.js';
import { SPECIES_LIST } from '../lib/domain.js';
import { today, fmtDate, fmtRub, fmtNum, parseNum, plural } from '../lib/format.js';
import { UNITS, unitOf, ensureFeeds, useFeedUntil, headcount, feedCalc, fmtUnits, feedArrived, feedSetStock, deleteFeed, defaultUntil } from '../lib/feed.js';
import { go, back } from '../lib/router.js';
import { Screen, Button, Field, Chips, Segmented, Sheet, DateField, Section, Empty, useUi, useAction } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const dayWord = (n) => plural(n, 'день', 'дня', 'дней');

function level(daysLeft, toUntil) {
  if (!Number.isFinite(daysLeft)) return 'ok';
  if (daysLeft < 14) return 'bad';
  if (daysLeft < Math.min(45, toUntil)) return 'warn';
  return 'ok';
}

/* ---------- Запасы кормов ---------- */
export function Feed() {
  const animals = useAnimals();
  const feeds = useLiveQuery(() => db.feeds.toArray(), []);
  const until = useFeedUntil();
  const [sheet, setSheet] = useState(null);
  useEffect(() => { ensureFeeds(); }, []);
  const counts = useMemo(() => headcount(animals), [animals]);

  if (!feeds || !animals) return <Screen title="Корма" />;
  const totalNeed = feeds.reduce((s, f) => s + feedCalc(f, counts, until).needCost, 0);

  return (
    <Screen title="Корма" sub="Запасы и сколько докупить" backTo="/more" right={<button className="icon-btn press" onClick={() => go('/feed/new')} aria-label="Добавить корм"><Icon name="plus" /></button>}>
      <button className="card until press" onClick={() => setSheet({ type: 'until' })}>
        <Icon name="calendar" />
        <span className="row-main">
          <span className="row-sub">Считаем до</span>
          <span className="row-title">{fmtDate(until, { year: true })}</span>
          <span className="row-sub">через {feedCalc(feeds[0] || {}, counts, until).toUntil} {dayWord(feedCalc(feeds[0] || {}, counts, until).toUntil)}</span>
        </span>
        <span className="until-edit"><Icon name="edit" />Изменить</span>
      </button>

      <p className="pill-note">Сейчас на хозяйстве: {SPECIES_LIST.filter((s) => counts[s.key]).map((s) => `${s.many.toLowerCase()} ${counts[s.key]}`).join(', ') || 'никого'}.</p>

      {feeds.length === 0 && (
        <Empty icon="hay" title="Кормов нет" text="Добавьте сено, зерно или другой корм.">
          <Button kind="primary" icon="plus" onClick={() => go('/feed/new')}>Добавить корм</Button>
        </Empty>
      )}

      {feeds.map((f) => {
        const c = feedCalc(f, counts, until);
        const lv = level(c.daysLeft, c.toUntil);
        const pct = Number.isFinite(c.daysLeft) && c.toUntil ? Math.min(100, (c.daysLeft / c.toUntil) * 100) : 100;
        return (
          <div key={f.id} className={`card feed feed-${lv}`}>
            <button className="feed-head press" onClick={() => go(`/feed/${f.id}`)}>
              <span className={`feed-ico ${f.kind}`}><Icon name={f.kind === 'grain' ? 'coins' : 'hay'} /></span>
              <span className="row-main">
                <span className="row-title">{f.name}</span>
                <span className="row-sub">в день уходит {fmtUnits(c.daily, f.unit)}{f.unit !== 'кг' ? ` (${fmtNum(c.dailyKg)} кг)` : ''}</span>
              </span>
              <Icon name="chevron" />
            </button>
            <div className="feed-stock">
              <div><span>Осталось</span><b>≈ {fmtUnits(c.stock, f.unit)}</b></div>
              <div>
                <span>Хватит</span>
                <b>{Number.isFinite(c.daysLeft) ? `на ${Math.floor(c.daysLeft)} ${dayWord(Math.floor(c.daysLeft))}` : 'расхода нет'}</b>
              </div>
            </div>
            <div className="feed-bar"><i style={{ width: `${pct}%` }} /></div>
            <div className="feed-note">
              {c.runOut && c.daysLeft < c.toUntil ? `Закончится ≈ ${fmtDate(c.runOut)}. ` : c.daily > 0 ? `Хватит до ${fmtDate(until)} с запасом. ` : ''}
              {c.need > 0 && <>До {fmtDate(until)} нужно докупить <b>{fmtUnits(Math.ceil(c.need), f.unit)}</b>{f.price ? <>, это ≈ <b>{fmtRub(c.needCost)}</b></> : ''}.</>}
            </div>
            <div className="btn-row">
              <Button icon="plus" onClick={() => setSheet({ type: 'in', f })}>Привезли</Button>
              <Button icon="edit" onClick={() => setSheet({ type: 'set', f, c })}>Остаток</Button>
            </div>
          </div>
        );
      })}

      {totalNeed > 0 && (
        <div className="card feed-total">
          <span>Всего на докупку кормов до {fmtDate(until)}</span>
          <b>≈ {fmtRub(totalNeed)}</b>
          <Button size="sm" icon="coins" onClick={() => go('/plan')}>План трат по месяцам</Button>
        </div>
      )}
      <p className="pill-note">Остаток уменьшается сам каждый день по нормам расхода. Если пересчитали запас, нажмите «Остаток» и введите точное число.</p>

      {sheet?.type === 'until' && <UntilSheet until={until} onClose={() => setSheet(null)} />}
      {sheet?.type === 'in' && <ArrivedSheet f={sheet.f} onClose={() => setSheet(null)} />}
      {sheet?.type === 'set' && <StockSheet f={sheet.f} c={sheet.c} onClose={() => setSheet(null)} />}
    </Screen>
  );
}

function UntilSheet({ until, onClose }) {
  const [v, setV] = useState(until);
  const run = useAction();
  const y = Number(today().slice(0, 4));
  const presets = [
    { label: 'До 15 мая', value: defaultUntil() },
    { label: 'До 1 апреля', value: today() < `${y}-04-01` ? `${y}-04-01` : `${y + 1}-04-01` },
    { label: 'До 1 июня', value: today() < `${y}-06-01` ? `${y}-06-01` : `${y + 1}-06-01` },
  ];
  const save = async () => { if (await run(() => setSetting('feedUntil', v), `Считаем до ${fmtDate(v, { year: true })}`)) onClose(); };
  return (
    <Sheet open onClose={onClose} title="До какой даты считать">
      <p className="muted">Обычно до выхода на пастбище, когда корма больше не нужны.</p>
      <div className="chips">{presets.map((p) => <button key={p.label} className={`chip press ${v === p.value ? 'on' : ''}`} onClick={() => setV(p.value)}>{p.label}</button>)}</div>
      <input id="until" className="input" type="date" min={today()} value={v} onChange={(e) => e.target.value && setV(e.target.value)} />
      <Button kind="primary" size="lg" block icon="check" onClick={save}>Сохранить</Button>
    </Sheet>
  );
}

function ArrivedSheet({ f, onClose }) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState(f.price ? String(f.price) : '');
  const [toFin, setToFin] = useState(true);
  const run = useAction();
  const a = parseNum(amount), p = parseNum(price);
  const save = async () => {
    if (await run(() => feedArrived(f, { date, amount: a, price: p, toFinance: toFin }), `${f.name}: +${fmtUnits(a, f.unit)}`)) onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Привезли: ${f.name.toLowerCase()}`}>
      <Field label="Сколько" htmlFor="inAmount">
        <div className="input-unit"><input id="inAmount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus placeholder="0" /><span>{unitOf(f.unit).forms[2]}</span></div>
      </Field>
      <Field label={`Цена за ${unitOf(f.unit).per}`} htmlFor="inPrice" hint={a && p ? `Итого: ${fmtRub(a * p)}` : 'Можно не указывать.'}>
        <div className="input-unit"><input id="inPrice" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /><span>₽</span></div>
      </Field>
      <DateField value={date} onChange={setDate} id="inDate" />
      {a && p ? (
        <Field label="Записать в расходы?">
          <Segmented options={[{ value: true, label: 'Да' }, { value: false, label: 'Нет, уже записано' }]} value={toFin} onChange={setToFin} />
        </Field>
      ) : null}
      <Button kind="primary" size="lg" block icon="check" disabled={!a} onClick={save}>Записать</Button>
    </Sheet>
  );
}

function StockSheet({ f, c, onClose }) {
  const [amount, setAmount] = useState(String(Math.round(c.stock)));
  const run = useAction();
  const a = parseNum(amount);
  const save = async () => {
    if (await run(() => feedSetStock(f, { date: today(), amount: a ?? 0 }), `Остаток: ${fmtUnits(a ?? 0, f.unit)}`)) onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Сколько сейчас: ${f.name.toLowerCase()}`}>
      <p className="muted">По расчёту осталось ≈ {fmtUnits(c.stock, f.unit)}. Введите, сколько есть на самом деле.</p>
      <div className="input-unit"><input id="stockAmount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /><span>{unitOf(f.unit).forms[2]}</span></div>
      <Button kind="primary" size="lg" block icon="check" disabled={a === null} onClick={save}>Сохранить остаток</Button>
    </Sheet>
  );
}

/* ---------- Карточка корма: единицы, цена, нормы ---------- */
export function FeedEdit({ id }) {
  const existing = useLiveQuery(() => (id ? db.feeds.get(id) : null), [id]);
  const log = useLiveQuery(() => (id ? db.feedLog.where({ feedId: id }).reverse().sortBy('date') : []), [id]);
  const [f, setF] = useState(null);
  const { confirm } = useUi();
  const run = useAction();

  useEffect(() => {
    if (f) return;
    if (!id) setF({ name: '', kind: 'other', unit: 'мешок', unitKg: '40', price: '', norms: { sheep: '', cow: '', horse: '' } });
    else if (existing) setF({ ...existing, unitKg: String(existing.unitKg ?? ''), price: String(existing.price ?? ''), norms: Object.fromEntries(SPECIES_LIST.map((s) => [s.key, String(existing.norms?.[s.key] ?? '')])) });
  }, [existing, id, f]);
  if (!f) return <Screen title="Корм" />;

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const u = unitOf(f.unit);
  const save = async () => {
    const rec = {
      name: f.name.trim() || 'Корм', kind: f.kind, unit: f.unit, unitKg: u.fixed ? u.kg : parseNum(f.unitKg) || u.kg,
      price: parseNum(f.price) || 0, norms: Object.fromEntries(SPECIES_LIST.map((s) => [s.key, parseNum(f.norms[s.key]) || 0])),
    };
    const ok = await run(() => (id ? db.feeds.update(id, rec) : db.feeds.add({ ...rec, stock: 0, stockDate: today() })), 'Сохранено');
    if (ok) back('/feed');
  };
  const del = async () => {
    if (await confirm({ icon: 'trash', danger: true, title: `Удалить «${f.name}»?`, text: 'Запас и история прихода этого корма удалятся. Расходы в финансах останутся.', ok: 'Удалить' })) {
      if (await run(() => deleteFeed(id), 'Корм удалён')) back('/feed');
    }
  };

  return (
    <Screen title={id ? f.name : 'Новый корм'} backTo="/feed" className="with-footer" footer={<Button kind="primary" size="lg" block icon="check" onClick={save}>Сохранить</Button>}>
      <div className="form">
        <Field label="Название" htmlFor="fName"><input id="fName" className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Например: сенаж, комбикорм" /></Field>
        <Field label="Вид корма">
          <Segmented options={[{ value: 'hay', label: 'Сено' }, { value: 'grain', label: 'Зерно' }, { value: 'other', label: 'Другое' }]} value={f.kind} onChange={(v) => set({ kind: v })} />
        </Field>
        <Field label="В чём считать">
          <Chips options={UNITS.map((x) => ({ value: x.key, label: x.label }))} value={f.unit} onChange={(v) => set({ unit: v, unitKg: String(unitOf(v).kg) })} />
        </Field>
        {!u.fixed && (
          <Field label={`Сколько весит один ${unitOf(f.unit).per}`} htmlFor="fKg" hint="Нужно, чтобы пересчитать нормы из килограммов.">
            <div className="input-unit"><input id="fKg" className="input" inputMode="decimal" value={f.unitKg} onChange={(e) => set({ unitKg: e.target.value })} /><span>кг</span></div>
          </Field>
        )}
        <Field label={`Цена за ${u.per}`} htmlFor="fPrice" hint="Для расчёта, сколько денег уйдёт на корма.">
          <div className="input-unit"><input id="fPrice" className="input" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} placeholder="0" /><span>₽</span></div>
        </Field>
        <Section title="Норма на одну голову в день">
          {SPECIES_LIST.map((s) => (
            <Field key={s.key} label={s.many} htmlFor={`n-${s.key}`}>
              <div className="input-unit"><input id={`n-${s.key}`} className="input" inputMode="decimal" value={f.norms[s.key]} onChange={(e) => set({ norms: { ...f.norms, [s.key]: e.target.value } })} placeholder="0" /><span>кг</span></div>
            </Field>
          ))}
          <p className="pill-note">Норма считается на каждую голову на хозяйстве, включая молодняк. Поставьте 0, если этот вид корм не ест.</p>
        </Section>
        {id && log && log.length > 0 && (
          <Section title="История">
            <div className="timeline">
              {log.slice(0, 30).map((l) => (
                <div key={l.id} className="ev">
                  <span className={`ev-ico ${l.type === 'in' ? 'tone-green' : 'tone-plain'}`}><Icon name={l.type === 'in' ? 'plus' : 'edit'} /></span>
                  <span className="ev-main">
                    <span className="ev-title">{l.type === 'in' ? `Привезли ${fmtUnits(l.amount, f.unit)}` : `Остаток: ${fmtUnits(l.amount, f.unit)}`}</span>
                    {l.total ? <span className="ev-sub">{fmtRub(l.total)}</span> : null}
                  </span>
                  <span className="ev-date">{fmtDate(l.date)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
        {id && <Button kind="ghost" icon="trash" onClick={del}>Удалить корм</Button>}
      </div>
    </Screen>
  );
}
