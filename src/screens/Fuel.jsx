import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../lib/db.js';
import { today, fmtDate, fmtRub, fmtNum, fmtMonth, parseNum, plural, MONTHS_SHORT, MONTHS_NOM } from '../lib/format.js';
import { monthRange, shiftMonth, yearMonths } from '../lib/stats.js';
import { go, back, useKeep } from '../lib/router.js';
import { Screen, Button, Field, Chips, Segmented, DateField, Section, Empty, Sheet, useUi, useAction } from '../components/ui.jsx';
import BarChart from '../components/BarChart.jsx';
import Icon from '../components/Icon.jsx';

// Заправки хранятся в финансах как расход в статье «Топливо».
// Подробности (литры, цена, техника) лежат в поле fuel.
export const FUEL_TYPES = ['АИ-92', 'АИ-95', 'Дизель'];
export const DEFAULT_VEHICLES = ['Машина', 'Трактор', 'Другое'];

const isFuel = (r) => r.kind === 'expense' && r.category === 'fuel';
const round2 = (n) => Math.round(n * 100) / 100;
const str = (n) => (n ? String(round2(n)).replace('.', ',') : '');

export function useVehicles() {
  const row = useLiveQuery(() => db.settings.get('vehicles'), []);
  return row?.value?.length ? row.value : DEFAULT_VEHICLES;
}

function fuelTotals(rows) {
  const t = { sum: 0, liters: 0, count: rows.length, byVehicle: {}, byType: {} };
  for (const r of rows) {
    const l = r.fuel?.liters || 0;
    t.sum += r.amount; t.liters += l;
    const v = r.fuel?.vehicle || 'Не указано', ty = r.fuel?.type || 'Не указано';
    (t.byVehicle[v] ||= { sum: 0, liters: 0 }); t.byVehicle[v].sum += r.amount; t.byVehicle[v].liters += l;
    (t.byType[ty] ||= { sum: 0, liters: 0 }); t.byType[ty].sum += r.amount; t.byType[ty].liters += l;
  }
  t.avg = t.liters ? t.sum / t.liters : 0;
  return t;
}

function Breakdown({ data }) {
  const list = Object.entries(data).sort((a, b) => b[1].sum - a[1].sum);
  const max = Math.max(1, ...list.map((x) => x[1].sum));
  return (
    <div className="cats">
      {list.map(([k, v]) => (
        <div key={k} className="cat">
          <div className="cat-top"><span>{k}{v.liters ? `, ${fmtNum(v.liters)} л` : ''}</span><b>{fmtRub(v.sum)}</b></div>
          <div className="cat-bar"><i className="bg-expense" style={{ width: `${(v.sum / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Сводка по топливу ---------- */
export function Fuel() {
  const all = useLiveQuery(() => db.finance.where('category').equals('fuel').toArray(), []);
  const [mode, setMode] = useKeep('fuel.mode', 'month');
  const [ym, setYm] = useKeep('fuel.ym', today().slice(0, 7));
  const [year, setYear] = useKeep('fuel.year', Number(today().slice(0, 4)));
  const [sel, setSel] = useState(null);
  const [vehSheet, setVehSheet] = useState(false);
  const cur = today().slice(0, 7);
  const rows = useMemo(() => (all || []).filter(isFuel), [all]);

  if (!all) return <Screen title="Топливо" />;
  const range = mode === 'month' ? monthRange(ym) : { from: `${year}-01-01`, to: `${year}-12-31` };
  const list = rows.filter((r) => r.date >= range.from && r.date <= range.to).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  const t = fuelTotals(list);

  const months = mode === 'year' ? yearMonths(year) : Array.from({ length: 12 }, (_, i) => shiftMonth(ym, i - 11));
  const chart = months.map((m) => {
    const r = monthRange(m);
    const x = fuelTotals(rows.filter((f) => f.date >= r.from && f.date <= r.to));
    return { key: m, label: MONTHS_SHORT[Number(m.slice(5)) - 1], values: { expense: x.sum }, liters: x.liters, count: x.count, dim: m > cur };
  });
  const selKey = sel && months.includes(sel) ? sel : mode === 'month' ? ym : months.includes(cur) ? cur : months[11];
  const selRow = chart.find((c) => c.key === selKey);

  return (
    <Screen title="Топливо" sub="Заправки и расход" backTo="/more" right={<button className="icon-btn press" onClick={() => setVehSheet(true)} aria-label="Список техники"><Icon name="settings" /></button>}>
      <Button kind="primary" size="lg" icon="fuel" block onClick={() => go('/fuel/new')}>Заправка</Button>

      <Segmented options={[{ value: 'month', label: 'Месяц' }, { value: 'year', label: 'Год' }]} value={mode} onChange={setMode} />
      {mode === 'month' ? (
        <div className="period-nav">
          <Button icon="back" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Предыдущий месяц" />
          <b>{fmtMonth(ym)}</b>
          <Button icon="chevron" disabled={ym >= cur} onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Следующий месяц" />
        </div>
      ) : (
        <div className="period-nav">
          <Button icon="back" onClick={() => setYear(year - 1)} aria-label="Предыдущий год" />
          <b>{year} год</b>
          <Button icon="chevron" disabled={year >= Number(cur.slice(0, 4))} onClick={() => setYear(year + 1)} aria-label="Следующий год" />
        </div>
      )}

      <div className="card sale-sum">
        <div className="sale-big"><b>{fmtRub(t.sum)}</b><span>потрачено на топливо</span></div>
        <dl className="kv">
          <dt>Литров</dt><dd>{fmtNum(t.liters)} л</dd>
          <dt>Заправок</dt><dd>{t.count} {plural(t.count, 'раз', 'раза', 'раз')}</dd>
          <dt>Средняя цена</dt><dd>{t.avg ? `${fmtNum(round2(t.avg))} ₽ за литр` : '—'}</dd>
        </dl>
      </div>

      <Section title={mode === 'year' ? `По месяцам ${year} года` : 'Последние 12 месяцев'}>
        <BarChart
          rows={chart}
          series={[{ key: 'expense', label: 'Топливо', cls: 'expense' }]}
          selected={selKey}
          onSelect={(k) => (mode === 'month' ? setYm(k) : setSel(k))}
          label="Расход на топливо по месяцам"
          readout={selRow && (
            <div className="readout">
              <b>{MONTHS_NOM[Number(selKey.slice(5)) - 1]} {selKey.slice(0, 4)}</b>
              <span><i className="dot bg-expense" />{fmtRub(selRow.values.expense)}, {fmtNum(selRow.liters)} л, заправок: {selRow.count}</span>
            </div>
          )}
        />
      </Section>

      {list.length > 0 && (
        <>
          <Section title="По технике"><Breakdown data={t.byVehicle} /></Section>
          <Section title="По виду топлива"><Breakdown data={t.byType} /></Section>
        </>
      )}

      <Section title="Заправки">
        {list.length === 0 ? (
          <Empty icon="fuel" title="За этот период заправок нет" text="Нажмите «Заправка» вверху. Расход сам попадёт в финансы, в статью «Топливо»." />
        ) : (
          <div className="list">
            {list.map((r) => (
              <button key={r.id} className="row money-row press" onClick={() => go(`/fuel/${r.id}`)}>
                <span className="money-ico expense"><Icon name="fuel" /></span>
                <span className="row-main">
                  <span className="row-title">{r.fuel?.liters ? `${fmtNum(r.fuel.liters)} л, ` : ''}{r.fuel?.type || 'Топливо'}</span>
                  <span className="row-sub">{fmtDate(r.date)}{r.fuel?.vehicle ? `, ${r.fuel.vehicle.toLowerCase()}` : ''}{r.fuel?.price ? `, ${fmtNum(r.fuel.price)} ₽/л` : ''}</span>
                </span>
                <b className="money-amt">{fmtRub(r.amount)}</b>
              </button>
            ))}
          </div>
        )}
      </Section>
      {vehSheet && <VehiclesSheet onClose={() => setVehSheet(false)} />}
    </Screen>
  );
}

/* ---------- Список техники ---------- */
function VehiclesSheet({ onClose }) {
  const vehicles = useVehicles();
  const [name, setName] = useState('');
  const run = useAction();
  const add = async () => {
    const n = name.trim();
    if (!n || vehicles.some((v) => v.toLowerCase() === n.toLowerCase())) return;
    if (await run(() => setSetting('vehicles', [...vehicles, n]), `Добавлено: ${n}`)) setName('');
  };
  const remove = (v) => run(() => setSetting('vehicles', vehicles.filter((x) => x !== v)));
  return (
    <Sheet open onClose={onClose} title="На что заправляем">
      <p className="muted">Этот список появляется при записи заправки. Старые записи при удалении не меняются.</p>
      <div className="list">
        {vehicles.map((v) => (
          <div key={v} className="row">
            <span className="row-main"><span className="row-title">{v}</span></span>
            {vehicles.length > 1 && <button className="ev-del press" onClick={() => remove(v)} aria-label={`Удалить: ${v}`}><Icon name="trash" /></button>}
          </div>
        ))}
      </div>
      <Field label="Добавить" htmlFor="vehName">
        <div className="picker-tag">
          <input id="vehName" className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Например: квадроцикл" />
          <Button kind="dark" icon="plus" disabled={!name.trim()} onClick={add}>Добавить</Button>
        </div>
      </Field>
    </Sheet>
  );
}

/* ---------- Заправка: новая запись и изменение ---------- */
export function FuelEntry({ id }) {
  const existing = useLiveQuery(() => (id ? db.finance.get(id) : null), [id]);
  const past = useLiveQuery(() => db.finance.where('category').equals('fuel').toArray(), []);
  const vehicles = useVehicles();
  const [f, setF] = useState(null);
  const { confirm } = useUi();
  const run = useAction();

  // последняя цена для каждого вида топлива и последний выбор
  const lastOf = useMemo(() => {
    const rows = (past || []).filter(isFuel).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    const price = {};
    for (const r of rows) if (r.fuel?.type && r.fuel?.price) price[r.fuel.type] = r.fuel.price;
    const last = rows[rows.length - 1];
    return { price, type: last?.fuel?.type, vehicle: last?.fuel?.vehicle };
  }, [past]);

  useEffect(() => {
    if (f || !past) return;
    if (id) {
      if (!existing) return;
      setF({ type: existing.fuel?.type || FUEL_TYPES[0], liters: str(existing.fuel?.liters), price: str(existing.fuel?.price), sum: str(existing.amount), vehicle: existing.fuel?.vehicle || '', date: existing.date, note: existing.fuel?.note || '', edited: 'liters' });
    } else {
      const type = lastOf.type || FUEL_TYPES[0];
      setF({ type, liters: '', price: str(lastOf.price[type]), sum: '', vehicle: lastOf.vehicle || vehicles[0], date: today(), note: '', edited: 'liters' });
    }
  }, [f, past, existing, id, lastOf, vehicles]);
  if (!f) return <Screen title="Заправка" />;

  // Из трёх чисел (литры, цена, сумма) считаем третье по двум введённым.
  const change = (field, value) => setF((x) => {
    const n = { ...x, [field]: value };
    const L = parseNum(n.liters), P = parseNum(n.price), S = parseNum(n.sum);
    if (field === 'liters') { n.edited = 'liters'; if (L && P) n.sum = str(L * P); else if (L && S && !P) n.price = str(S / L); }
    if (field === 'sum') { n.edited = 'sum'; if (S && P) n.liters = str(S / P); else if (S && L && !P) n.price = str(S / L); }
    if (field === 'price') {
      if (P && x.edited === 'sum' && S) n.liters = str(S / P);
      else if (P && L) n.sum = str(L * P);
      else if (P && S) n.liters = str(S / P);
    }
    return n;
  });
  const setType = (type) => setF((x) => {
    const n = { ...x, type };
    if (!id && lastOf.price[type]) {
      n.price = str(lastOf.price[type]);
      const L = parseNum(n.liters), S = parseNum(n.sum), P = lastOf.price[type];
      if (x.edited === 'sum' && S) n.liters = str(S / P); else if (L) n.sum = str(L * P);
    }
    return n;
  });

  const L = parseNum(f.liters), P = parseNum(f.price), S = parseNum(f.sum);
  const save = async () => {
    const rec = {
      date: f.date, kind: 'expense', category: 'fuel', amount: round2(S),
      note: `${f.type}${L ? `, ${fmtNum(L)} л` : ''}${f.vehicle ? `, ${f.vehicle.toLowerCase()}` : ''}${f.note.trim() ? `. ${f.note.trim()}` : ''}`,
      fuel: { type: f.type, liters: L ? round2(L) : null, price: P ? round2(P) : null, vehicle: f.vehicle, note: f.note.trim() },
    };
    const ok = await run(() => (id ? db.finance.update(id, rec) : db.finance.add(rec)), `Заправка записана: ${fmtRub(S)}`);
    if (ok) back('/fuel');
  };
  const del = async () => {
    if (await confirm({ icon: 'trash', danger: true, title: 'Удалить эту заправку?', text: `${fmtRub(S)}, ${fmtDate(f.date, { year: true })}. Расход уберётся из финансов.`, ok: 'Удалить' })) {
      if (await run(() => db.finance.delete(id), 'Заправка удалена')) back('/fuel');
    }
  };

  return (
    <Screen
      title={id ? 'Изменить заправку' : 'Заправка'}
      backTo="/fuel"
      className="with-footer"
      footer={
        <>
          <div className="sale-total"><span>Сумма</span><b>{fmtRub(S || 0)}</b></div>
          <Button kind="primary" size="lg" block icon="check" disabled={!S} onClick={save}>Записать заправку</Button>
        </>
      }
    >
      <div className="form">
        <Field label="Топливо">
          <Segmented options={FUEL_TYPES.map((t) => ({ value: t, label: t }))} value={f.type} onChange={setType} />
        </Field>
        <Field label="Литры" htmlFor="fuelL">
          <div className="input-unit"><input id="fuelL" className="input input-money" inputMode="decimal" value={f.liters} onChange={(e) => change('liters', e.target.value)} placeholder="0" autoFocus={!id} /><span>л</span></div>
        </Field>
        <Field label="Цена за литр" htmlFor="fuelP" hint={!id && lastOf.price[f.type] ? `Подставлена цена с прошлой заправки: ${fmtNum(lastOf.price[f.type])} ₽.` : null}>
          <div className="input-unit"><input id="fuelP" className="input" inputMode="decimal" value={f.price} onChange={(e) => change('price', e.target.value)} placeholder="0" /><span>₽/л</span></div>
        </Field>
        <Field label="Сумма" htmlFor="fuelS" hint="Можно ввести сумму вместо литров: литры посчитаются сами.">
          <div className="input-unit"><input id="fuelS" className="input input-money" inputMode="decimal" value={f.sum} onChange={(e) => change('sum', e.target.value)} placeholder="0" /><span>₽</span></div>
        </Field>
        <Field label="На что заправляли">
          <Chips options={[...new Set([...vehicles, ...(f.vehicle ? [f.vehicle] : [])])].map((v) => ({ value: v, label: v }))} value={f.vehicle} onChange={(v) => setF({ ...f, vehicle: v })} />
        </Field>
        <DateField value={f.date} onChange={(v) => setF({ ...f, date: v })} />
        <Field label="Заметка" htmlFor="fuelNote" hint="Необязательно.">
          <input id="fuelNote" className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Например: полный бак" />
        </Field>
        {id && <Button kind="ghost" icon="trash" onClick={del}>Удалить заправку</Button>}
      </div>
    </Screen>
  );
}
