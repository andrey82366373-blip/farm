import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, recordSale, deleteSale, saleTotal } from '../lib/db.js';
import { useAnimals } from '../lib/data.js';
import { SPECIES, SPECIES_LIST } from '../lib/domain.js';
import { today, fmtDate, fmtRub, fmtNum, fmtMonth, heads, parseNum } from '../lib/format.js';
import { go, back, useKeep } from '../lib/router.js';
import { Screen, Button, Field, Segmented, DateField, PickedSummary, Empty, Section, useUi, useAction } from '../components/ui.jsx';
import AnimalRow from '../components/AnimalRow.jsx';
import Icon from '../components/Icon.jsx';
import { PickStep, useIdsFromQuery } from './EventForms.jsx';
import { monthRange, shiftMonth } from '../lib/stats.js';

/* ---------- Новая продажа ---------- */
export function SaleNew() {
  const animals = useAnimals();
  const pastBuyers = useLiveQuery(async () => {
    const s = await db.sales.orderBy('date').reverse().limit(50).toArray();
    return [...new Set(s.map((x) => x.buyer).filter(Boolean))].slice(0, 6);
  }, []);
  const initial = useIdsFromQuery();
  const [selected, setSelected] = useState(initial);
  const [step, setStep] = useState(initial.size ? 'details' : 'pick');
  const [date, setDate] = useState(today());
  const [buyer, setBuyer] = useState('');
  const [mode, setMode] = useState('head');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const run = useAction();

  if (!animals) return <Screen title="Продажа" />;
  if (step === 'pick') {
    return (
      <PickStep
        title="Продажа" animals={animals} selected={selected} setSelected={setSelected} onNext={() => setStep('details')}
        hint="Введите номера бирок по одному или отметьте галочками в списке."
      />
    );
  }
  const picked = animals.filter((a) => selected.has(a.id));
  const p = parseNum(price);
  const w = parseNum(weight);
  const total = saleTotal({ mode, price: p, weight: w, count: picked.length });
  const needWeight = mode === 'kg' && !w;

  const save = async () => {
    const id = await run(() => recordSale({ ids: picked.map((a) => a.id), date, buyer, mode, price: p, weight: w, note }), `Продано: ${heads(picked.length)} на ${fmtRub(total)}`);
    if (id) go(`/sale/${id}`, { replace: true });
  };

  return (
    <Screen
      title="Продажа"
      className="with-footer"
      footer={
        <>
          <div className="sale-total"><span>Итого</span><b>{fmtRub(total)}</b></div>
          <Button kind="primary" size="lg" block icon="check" disabled={!picked.length || !p || needWeight} onClick={save}>Записать продажу</Button>
        </>
      }
    >
      <div className="form">
        <PickedSummary animals={picked} onEdit={() => setStep('pick')} />
        <DateField value={date} onChange={setDate} />
        <Field label="Покупатель" htmlFor="buyer">
          <input id="buyer" className="input" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Имя или организация" />
          {pastBuyers?.length > 0 && !buyer && (
            <div className="chips">
              {pastBuyers.map((b) => <button key={b} className="chip press" onClick={() => setBuyer(b)}>{b}</button>)}
            </div>
          )}
        </Field>
        <Field label="Цена">
          <Segmented options={[{ value: 'head', label: 'За голову' }, { value: 'kg', label: 'За килограмм' }]} value={mode} onChange={setMode} />
          <div className="input-unit">
            <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            <span>{mode === 'kg' ? '₽/кг' : '₽'}</span>
          </div>
        </Field>
        <Field
          label={mode === 'kg' ? 'Общий вес' : 'Общий вес (если взвешивали)'}
          htmlFor="weight"
          error={mode === 'kg' && price && !w ? 'Для цены за килограмм нужен вес.' : null}
          hint={w && picked.length > 1 ? `В среднем ${fmtNum(w / picked.length)} кг на голову` : null}
        >
          <div className="input-unit">
            <input id="weight" className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" />
            <span>кг</span>
          </div>
        </Field>
        <Field label="Заметка" htmlFor="note">
          <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: забрал сам, расчёт наличными" />
        </Field>
        {total > 0 && picked.length > 1 && <p className="pill-note">В среднем {fmtRub(total / picked.length)} за голову. Доход сам попадёт в финансы.</p>}
      </div>
    </Screen>
  );
}

/* ---------- Одна продажа ---------- */
export function SaleView({ id }) {
  const sale = useLiveQuery(() => db.sales.get(id), [id]);
  const animals = useLiveQuery(() => (sale ? db.animals.bulkGet(sale.animalIds) : []), [sale]);
  const { confirm } = useUi();
  const run = useAction();

  if (sale === undefined) return <Screen title="Продажа" />;
  if (!sale) {
    return (
      <Screen title="Продажа" backTo="/sales">
        <Empty icon="sale" title="Продажа не найдена" text="Возможно, её отменили." />
      </Screen>
    );
  }
  const list = (animals || []).filter(Boolean);

  const cancel = async () => {
    const ok = await confirm({
      icon: 'undo', danger: true, title: 'Отменить продажу?',
      text: `${heads(sale.count)} вернутся на хозяйство, доход ${fmtRub(sale.total)} уберётся из финансов.`, ok: 'Отменить продажу', cancel: 'Не отменять',
    });
    if (ok && (await run(() => deleteSale(id), 'Продажа отменена'))) back('/sales');
  };

  return (
    <Screen title="Продажа" sub={fmtDate(sale.date, { year: true })} backTo="/sales">
      <div className="card sale-card">
        <div className="sale-big"><b>{fmtRub(sale.total)}</b><span>{heads(sale.count)}</span></div>
        <dl className="kv">
          <dt>Покупатель</dt><dd>{sale.buyer || 'не указан'}</dd>
          <dt>Цена</dt><dd>{fmtRub(sale.price)} {sale.mode === 'kg' ? 'за кг' : 'за голову'}</dd>
          {sale.weight && <><dt>Вес</dt><dd>{fmtNum(sale.weight)} кг{sale.count > 1 ? `, в среднем ${fmtNum(sale.weight / sale.count)} кг на голову` : ''}</dd></>}
          {sale.count > 1 && <><dt>За голову</dt><dd>в среднем {fmtRub(sale.total / sale.count)}</dd></>}
        </dl>
        {sale.note && <p className="animal-notes">{sale.note}</p>}
      </div>
      <Section title="Проданные животные">
        <div className="list">
          {list.map((a) => <AnimalRow key={a.id} a={a} onClick={() => go(`/animal/${a.id}`)} />)}
        </div>
      </Section>
      <Button kind="ghost" icon="undo" onClick={cancel}>Отменить продажу</Button>
    </Screen>
  );
}

/* ---------- Сводка по продажам ---------- */
function summarize(sales) {
  const s = { heads: 0, total: 0, weight: 0, weightTotal: 0, species: {} };
  for (const x of sales) {
    s.heads += x.count;
    s.total += x.total;
    if (x.weight) { s.weight += x.weight; s.weightTotal += x.total; }
  }
  return s;
}

export function Sales() {
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const animals = useAnimals();
  const [mode, setMode] = useKeep('sales.mode', 'year');
  const [ym, setYm] = useKeep('sales.ym', today().slice(0, 7));
  const [year, setYear] = useKeep('sales.year', Number(today().slice(0, 4)));

  const range = mode === 'month' ? monthRange(ym) : mode === 'year' ? { from: `${year}-01-01`, to: `${year}-12-31` } : { from: '0000', to: '9999' };
  const list = useMemo(() => (sales || []).filter((s) => s.date >= range.from && s.date <= range.to).sort((a, b) => (a.date < b.date ? 1 : -1)), [sales, range.from, range.to]);
  const sum = summarize(list);

  // разбивка по видам: делим сумму продажи поровну на головы
  const bySpecies = useMemo(() => {
    const byId = new Map((animals || []).map((a) => [a.id, a]));
    const r = {};
    for (const s of list) {
      const per = s.total / s.count;
      for (const id of s.animalIds) {
        const sp = byId.get(id)?.species ?? 'sheep';
        r[sp] ||= { heads: 0, total: 0 };
        r[sp].heads += 1;
        r[sp].total += per;
      }
    }
    return r;
  }, [list, animals]);

  const cur = today().slice(0, 7);
  return (
    <Screen
      title="Продажи"
      backTo="/more"
      right={<button className="icon-btn press" onClick={() => go('/sale/new')} aria-label="Новая продажа"><Icon name="plus" /></button>}
    >
      <Segmented options={[{ value: 'month', label: 'Месяц' }, { value: 'year', label: 'Год' }, { value: 'all', label: 'Всё время' }]} value={mode} onChange={setMode} />
      {mode === 'month' && (
        <div className="period-nav">
          <Button icon="back" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Предыдущий месяц" />
          <b>{fmtMonth(ym)}</b>
          <Button icon="chevron" disabled={ym >= cur} onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Следующий месяц" />
        </div>
      )}
      {mode === 'year' && (
        <div className="period-nav">
          <Button icon="back" onClick={() => setYear(year - 1)} aria-label="Предыдущий год" />
          <b>{year} год</b>
          <Button icon="chevron" disabled={year >= Number(cur.slice(0, 4))} onClick={() => setYear(year + 1)} aria-label="Следующий год" />
        </div>
      )}

      <div className="card sale-sum">
        <div className="sale-big"><b>{fmtRub(sum.total)}</b><span>продано {heads(sum.heads)}</span></div>
        <dl className="kv">
          <dt>Средняя цена</dt><dd>{sum.heads ? `${fmtRub(sum.total / sum.heads)} за голову` : '—'}</dd>
          {sum.weight > 0 && <><dt>За килограмм</dt><dd>в среднем {fmtRub(sum.weightTotal / sum.weight)}</dd></>}
          <dt>Сделок</dt><dd>{list.length}</dd>
        </dl>
        {Object.keys(bySpecies).length > 1 && (
          <div className="causes">
            {SPECIES_LIST.filter((s) => bySpecies[s.key]).map((s) => (
              <div key={s.key} className="cause"><span>{s.many}: {heads(bySpecies[s.key].heads)}</span><b>{fmtRub(bySpecies[s.key].total)}</b></div>
            ))}
          </div>
        )}
      </div>

      <Button kind="primary" size="lg" icon="sale" block onClick={() => go('/sale/new')}>Новая продажа</Button>

      {sales && list.length === 0 ? (
        <Empty icon="sale" title="За этот период продаж нет" text="Продажа записывается кнопкой выше или из карточки животного." />
      ) : (
        <div className="list">
          {list.map((s) => (
            <button key={s.id} className="row press" onClick={() => go(`/sale/${s.id}`)}>
              <span className="row-main">
                <span className="row-title">{fmtRub(s.total)}</span>
                <span className="row-sub">{fmtDate(s.date)}, {heads(s.count)}{s.species?.length ? ` (${s.species.map((k) => SPECIES[k].many.toLowerCase()).join(', ')})` : ''}{s.buyer ? `, ${s.buyer}` : ''}</span>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
