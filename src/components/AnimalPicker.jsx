import { useMemo, useState } from 'react';
import { SPECIES, SPECIES_LIST } from '../lib/domain.js';
import { filterAnimals } from '../lib/data.js';
import { heads } from '../lib/format.js';
import { Chips, TagInput, Button } from './ui.jsx';
import AnimalRow from './AnimalRow.jsx';
import Icon from './Icon.jsx';

// Выбор нескольких животных: ввод номера бирки или галочки в списке.
// Удобно и для десятков, и для сотен голов.
export default function AnimalPicker({ animals, selected, onChange, species: lockSpecies, group: initGroup, hint }) {
  const [species, setSpecies] = useState(lockSpecies ?? null);
  const [group, setGroup] = useState(initGroup ?? null);
  const [tag, setTag] = useState('');
  const [msg, setMsg] = useState(null);
  const [limit, setLimit] = useState(100);

  const pool = useMemo(() => (animals || []).filter((a) => a.status === 'active'), [animals]);
  const list = useMemo(() => filterAnimals(pool, { species, group, status: 'active' }), [pool, species, group]);

  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    onChange(s);
  };

  const markTag = () => {
    if (!tag) return;
    const hits = pool.filter((a) => a.tag === tag && (!species || a.species === species));
    if (hits.length === 0) setMsg({ bad: true, text: `Бирки ${tag} нет среди животных на хозяйстве` });
    else if (hits.length > 1) setMsg({ bad: true, text: `Бирка ${tag} есть у разных видов. Выберите вид выше.` });
    else {
      const a = hits[0];
      const had = selected.has(a.id);
      toggle(a.id);
      setMsg({ bad: false, text: had ? `${tag}: отметка снята` : `${tag}: отмечено` });
    }
    setTag('');
  };

  const allShown = list.length > 0 && list.every((a) => selected.has(a.id));
  const selectShown = () => {
    const s = new Set(selected);
    list.forEach((a) => (allShown ? s.delete(a.id) : s.add(a.id)));
    onChange(s);
  };

  const groupOpts = species
    ? [{ value: null, label: 'Все группы' }, ...SPECIES[species].groups
      .map((g) => ({ value: g.key, label: g.many, count: pool.filter((a) => a.species === species && a.group === g.key).length }))
      .filter((g) => g.count > 0)]
    : [];

  return (
    <div className="picker">
      {hint && <p className="muted">{hint}</p>}
      <div className="picker-tag">
        <TagInput id="pickTag" value={tag} onChange={(v) => { setTag(v); setMsg(null); }} onEnter={markTag} placeholder="Номер бирки" />
        <Button kind="dark" icon="check" onClick={markTag} disabled={!tag}>Отметить</Button>
      </div>
      {msg && <div className={`picker-msg ${msg.bad ? 'bad' : ''}`}><Icon name={msg.bad ? 'warning' : 'check'} />{msg.text}</div>}

      {!lockSpecies && (
        <Chips
          wrap={false}
          value={species}
          onChange={(v) => { setSpecies(v); setGroup(null); }}
          options={[{ value: null, label: 'Все' }, ...SPECIES_LIST.map((s) => ({ value: s.key, label: s.many, icon: s.icon, count: pool.filter((a) => a.species === s.key).length }))]}
        />
      )}
      {species && groupOpts.length > 2 && <Chips wrap={false} value={group} onChange={setGroup} options={groupOpts} />}

      <div className="picker-bar">
        <span>Показано: <b>{heads(list.length)}</b></span>
        {list.length > 0 && <Button size="sm" onClick={selectShown}>{allShown ? 'Снять всех' : 'Выбрать всех'}</Button>}
      </div>
      <div className="list">
        {list.slice(0, limit).map((a) => (
          <AnimalRow key={a.id} a={a} selectable selected={selected.has(a.id)} showSpecies={!species} onClick={() => toggle(a.id)} />
        ))}
      </div>
      {list.length > limit && <Button block onClick={() => setLimit(limit + 200)}>Показать ещё ({list.length - limit})</Button>}
    </div>
  );
}
