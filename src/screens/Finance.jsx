import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { useAnimals } from '../lib/data.js';
import { FINANCE_CATEGORIES } from '../lib/domain.js';
import { today, fmtDate, fmtRub, fmtMonth, parseNum, MONTHS_SHORT, MONTHS_NOM } from '../lib/format.js';
import { monthRange, shiftMonth, yearMonths } from '../lib/stats.js';
import { totals, catLabel, forecast } from '../lib/finance.js';
import { ensureFeeds, useFeedUntil, headcount, unitOf, fmtUnits } from '../lib/feed.js';
import { go, back, useKeep, useRoute } from '../lib/router.js';
import { Screen, Button, Field, Chips, Segmented, DateField, Section, Empty, useUi, useAction } from '../components/ui.jsx';
import BarChart from '../components/BarChart.jsx';
import Icon from '../components/Icon.jsx';

const SERIES = [
  { key: 'income', label: 'Доходы', cls: 'income' },
  { key: 'expense', label: 'Расходы', cls: 'expense' },
];

function CatBars({ kind, byCat }) {
  const list = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...list.map((x) => x[1]));
  if (!list.length) return <p className="muted">Нет записей.</p>;
  return (
    <div className="cats">
      {list.map(([k, v]) => (
        <div key={k} className="cat">
          <div className="cat-top"><span>{catLabel(kind, k)}</span><b>{fmtRub(v)}</b></div>
          <div className="cat-bar"><i className={`bg-${kind}`} style={{ width: `${(v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Финансы ---------- */
export function Finance() {
  const finance = useLiveQuery(() => db.finance.toArray(), []);
  const [mode, setMode] = useKeep('fin.mode', 'month');
  const [ym, setYm] = useKeep('fin.ym', today().slice(0, 7));
  const [year, setYear] = useKeep('fin.year', Number(today().slice(0, 4)));
  const [limit, setLimit] = useState(40);
  const cur = today().slice(0, 7);

  const range = mode === 'month' ? monthRange(ym) : { from: `${year}-01-01`, to: `${year}-12-31` };
  const t = useMemo(() => totals(finance || [], range.from, range.to), [finance, range.from, range.to]);
  const list = useMemo(() => (finance || []).filter((r) => r.date >= range.from && r.date <= range.to).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)), [finance, range.from, range.to]);

  // график: 12 месяцев года (или последние 12 для режима «месяц»)
  const chartMonths = mode === 'year' ? yearMonths(year) : Array.from({ length: 12 }, (_, i) => shiftMonth(ym, i - 11));
  const rows = chartMonths.map((m) => {
    const mr = monthRange(m);
    const x = totals(finance || [], mr.from, mr.to);
    return { key: m, label: MONTHS_SHORT[Number(m.slice(5)) - 1], values: { income: x.income, expense: x.expense }, dim: m > cur };
  });
  const [sel, setSel] = useState(null);
  const selKey = sel && chartMonths.includes(sel) ? sel : mode === 'month' ? ym : chartMonths.includes(cur) ? cur : chartMonths[11];
  const selRow = rows.find((r) => r.key === selKey);

  if (!finance) return <Screen title="Финансы" />;

  return (
    <Screen title="Финансы" backTo="/more">
      <div className="btn-row">
        <Button kind="primary" icon="minus" onClick={() => go('/money/new?kind=expense')}>Расход</Button>
        <Button kind="primary" icon="plus" onClick={() => go('/money/new?kind=income')}>Доход</Button>
      </div>

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

      <div className="card money-sum">
        <div className="money-line"><span><i className="dot bg-income" />Доходы</span><b>{fmtRub(t.income)}</b></div>
        <div className="money-line"><span><i className="dot bg-expense" />Расходы</span><b>{fmtRub(t.expense)}</b></div>
        <div className={`money-net ${t.net >= 0 ? 'plus' : 'minus'}`}>
          <span>{t.net >= 0 ? 'Остаётся' : 'Ушло в минус'}</span>
          <b>{t.net >= 0 ? '+' : '−'} {fmtRub(Math.abs(t.net))}</b>
        </div>
      </div>

      <Section title={mode === 'year' ? `По месяцам ${year} года` : 'Последние 12 месяцев'}>
        <BarChart
          rows={rows}
          series={SERIES}
          selected={selKey}
          onSelect={(k) => (mode === 'month' ? setYm(k) : setSel(k))}
          label="Доходы и расходы по месяцам"
          readout={selRow && (
            <div className="readout">
              <b>{MONTHS_NOM[Number(selKey.slice(5)) - 1]} {selKey.slice(0, 4)}</b>
              <span><i className="dot bg-income" />доходы {fmtRub(selRow.values.income)}</span>
              <span><i className="dot bg-expense" />расходы {fmtRub(selRow.values.expense)}</span>
            </div>
          )}
        />
        <p className="pill-note">Нажмите на месяц, чтобы увидеть точные суммы.</p>
      </Section>

      <Section title="Расходы по статьям"><CatBars kind="expense" byCat={t.byCat.expense} /></Section>
      <Section title="Доходы по статьям"><CatBars kind="income" byCat={t.byCat.income} /></Section>

      <button className="card plan-link press" onClick={() => go('/plan')}>
        <Icon name="calendar" />
        <span className="row-main">
          <span className="row-title">План и прогноз трат</span>
          <span className="row-sub">Сколько уйдёт на корма до весны и сколько денег понадобится по месяцам</span>
        </span>
        <Icon name="chevron" />
      </button>

      <Section title="Записи">
        {list.length === 0 ? (
          <Empty icon="coins" title="Записей за этот период нет" text="Расходы и доходы добавляются кнопками вверху. Продажи животных и приход кормов попадают сюда сами." />
        ) : (
          <div className="list">
            {list.slice(0, limit).map((r) => (
              <button key={r.id} className="row money-row press" onClick={() => (r.saleId ? go(`/sale/${r.saleId}`) : go(`/money/${r.id}`))}>
                <span className={`money-ico ${r.kind}`}><Icon name={r.kind === 'income' ? 'plus' : 'minus'} /></span>
                <span className="row-main">
                  <span className="row-title">{catLabel(r.kind, r.category)}</span>
                  <span className="row-sub">{fmtDate(r.date)}{r.note ? `, ${r.note}` : ''}</span>
                </span>
                <b className={`money-amt ${r.kind}`}>{r.kind === 'income' ? '+' : '−'}{fmtRub(r.amount)}</b>
              </button>
            ))}
          </div>
        )}
        {list.length > limit && <Button block onClick={() => setLimit(limit + 100)}>Показать ещё ({list.length - limit})</Button>}
      </Section>
    </Screen>
  );
}

/* ---------- Новая запись и изменение ---------- */
export function MoneyEntry({ id }) {
  const { query } = useRoute();
  const existing = useLiveQuery(() => (id ? db.finance.get(id) : null), [id]);
  const [f, setF] = useState(null);
  const { confirm } = useUi();
  const run = useAction();

  useEffect(() => {
    if (f) return;
    if (!id) { const kind = query.kind === 'income' ? 'income' : 'expense'; setF({ kind, category: FINANCE_CATEGORIES[kind][0].key, amount: '', date: today(), note: '' }); }
    else if (existing) setF({ ...existing, amount: String(existing.amount) });
  }, [existing, id, f, query.kind]);
  if (!f) return <Screen title="Запись" />;

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const amount = parseNum(f.amount);
  const save = async () => {
    const rec = { kind: f.kind, category: f.category, amount, date: f.date, note: f.note.trim() };
    const ok = await run(() => (id ? db.finance.update(id, rec) : db.finance.add(rec)), f.kind === 'income' ? 'Доход записан' : 'Расход записан');
    if (ok) back('/finance');
  };
  const del = async () => {
    if (await confirm({ icon: 'trash', danger: true, title: 'Удалить эту запись?', text: `${catLabel(f.kind, f.category)}: ${fmtRub(amount)}`, ok: 'Удалить' })) {
      if (await run(() => db.finance.delete(id), 'Запись удалена')) back('/finance');
    }
  };

  return (
    <Screen
      title={id ? 'Изменить запись' : f.kind === 'income' ? 'Новый доход' : 'Новый расход'}
      backTo="/finance"
      className="with-footer"
      footer={<Button kind="primary" size="lg" block icon="check" disabled={!amount} onClick={save}>Сохранить</Button>}
    >
      <div className="form">
        <Segmented options={[{ value: 'expense', label: 'Расход' }, { value: 'income', label: 'Доход' }]} value={f.kind} onChange={(k) => set({ kind: k, category: FINANCE_CATEGORIES[k][0].key })} />
        <Field label="Сумма" htmlFor="amount">
          <div className="input-unit"><input id="amount" className="input input-money" inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0" autoFocus={!id} /><span>₽</span></div>
        </Field>
        <Field label="Статья">
          <Chips options={FINANCE_CATEGORIES[f.kind].map((c) => ({ value: c.key, label: c.label }))} value={f.category} onChange={(v) => set({ category: v })} />
        </Field>
        <DateField value={f.date} onChange={(v) => set({ date: v })} />
        <Field label="Заметка" htmlFor="mNote">
          <input id="mNote" className="input" value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder={f.kind === 'income' ? 'Например: шерсть, 120 кг' : 'Например: солонцы, 10 шт.'} />
        </Field>
        {id && <Button kind="ghost" icon="trash" onClick={del}>Удалить запись</Button>}
      </div>
    </Screen>
  );
}

/* ---------- План и прогноз ---------- */
export function Plan() {
  const animals = useAnimals();
  const feeds = useLiveQuery(() => db.feeds.toArray(), []);
  const finance = useLiveQuery(() => db.finance.toArray(), []);
  const until = useFeedUntil();
  const [prices, setPrices] = useState({});
  const run = useAction();
  useEffect(() => { ensureFeeds(); }, []);
  const counts = useMemo(() => headcount(animals), [animals]);

  if (!feeds || !finance || !animals) return <Screen title="План и прогноз" />;
  const withPrices = feeds.map((f) => (prices[f.id] !== undefined ? { ...f, price: parseNum(prices[f.id]) || 0 } : f));
  const fc = forecast({ finance, feeds: withPrices, counts, until });
  const changed = Object.keys(prices).length > 0;
  const tillUntil = fc.feedParts.reduce((s, p) => s + p.c.costTillUntil, 0);
  const toBuy = fc.feedParts.reduce((s, p) => s + p.c.needCost, 0);
  const sixMonths = fc.months.reduce((s, m) => s + m.total, 0);

  const savePrices = async () => {
    const ok = await run(async () => {
      for (const [id, v] of Object.entries(prices)) await db.feeds.update(Number(id), { price: parseNum(v) || 0 });
    }, 'Цены сохранены');
    if (ok) setPrices({});
  };

  return (
    <Screen title="План и прогноз" sub={`Корма до ${fmtDate(until, { year: true })}`} backTo="/finance" className={changed ? 'with-footer' : ''} footer={changed ? <Button kind="primary" size="lg" block icon="check" onClick={savePrices}>Сохранить цены</Button> : null}>
      <Section title="Цены на корма">
        {withPrices.map((f) => (
          <Field key={f.id} label={`${f.name}, за ${unitOf(f.unit).per}`} htmlFor={`p-${f.id}`}>
            <div className="input-unit">
              <input id={`p-${f.id}`} className="input" inputMode="decimal" value={prices[f.id] ?? String(f.price || '')} onChange={(e) => setPrices({ ...prices, [f.id]: e.target.value })} placeholder="0" />
              <span>₽</span>
            </div>
          </Field>
        ))}
        <p className="pill-note">Нормы расхода и запасы меняются в разделе <button className="link" onClick={() => go('/feed')}>Корма</button>.</p>
      </Section>

      <div className="card plan-sum">
        <div><span>Скормим до {fmtDate(until)}</span><b>≈ {fmtRub(tillUntil)}</b><small>вместе с тем, что уже лежит</small></div>
        <div className="plan-buy"><span>Нужно докупить на</span><b>≈ {fmtRub(toBuy)}</b></div>
        {fc.feedParts.filter((p) => p.c.need > 0).map((p) => (
          <div key={p.f.id} className="plan-line">
            <span>{p.f.name}: {fmtUnits(Math.ceil(p.c.need), p.f.unit)}</span>
            <b>{fmtRub(p.c.needCost)}</b>
          </div>
        ))}
      </div>

      <Section title="Прогноз трат на 6 месяцев">
        <BarChart
          rows={fc.months.map((m) => ({ key: m.ym, label: MONTHS_SHORT[Number(m.ym.slice(5)) - 1], values: { expense: m.total } }))}
          series={[SERIES[1]]}
          label="Прогноз расходов по месяцам"
        />
        <div className="card fc-table">
          {fc.months.map((m) => (
            <div key={m.ym} className="fc-row">
              <span className="fc-month">{fmtMonth(m.ym)}</span>
              <b>≈ {fmtRub(m.total)}</b>
              <small>корма {fmtRub(m.feed)}, ветеринар и прочее {fmtRub(m.other)}</small>
            </div>
          ))}
          <div className="fc-row fc-total"><span className="fc-month">Всего за полгода</span><b>≈ {fmtRub(sixMonths)}</b></div>
        </div>
        <p className="pill-note">Корма считаются с того дня, когда закончится нынешний запас, и до {fmtDate(until)}. Ветеринар и прочее — среднее за последние полгода ({fmtRub(fc.otherAvg)} в месяц).</p>
      </Section>
    </Screen>
  );
}
