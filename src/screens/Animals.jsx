import { useEffect, useMemo } from 'react';
import { useAnimals, filterAnimals } from '../lib/data.js';
import { SPECIES, SPECIES_LIST } from '../lib/domain.js';
import { heads } from '../lib/format.js';
import { go, useKeep, useRoute } from '../lib/router.js';
import { SearchBox, Chips, Segmented, Button, Empty } from '../components/ui.jsx';
import AnimalRow from '../components/AnimalRow.jsx';

const PAGE = 150;

export default function Animals() {
  const { query } = useRoute();
  const animals = useAnimals();
  const [species, setSpecies] = useKeep('animals.species', query.species || null);
  const [group, setGroup] = useKeep('animals.group', null);
  const [status, setStatus] = useKeep('animals.status', 'active');
  const [q, setQ] = useKeep('animals.q', '');
  const [limit, setLimit] = useKeep('animals.limit', PAGE);

  // Переход с главной по карточке вида — сразу показываем этот вид.
  useEffect(() => {
    if (query.species) { setSpecies(query.species); setGroup(null); setStatus('active'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const base = useMemo(() => filterAnimals(animals, { status }), [animals, status]);
  const list = useMemo(() => filterAnimals(animals, { species, group, status, q }), [animals, species, group, status, q]);

  const spCount = (k) => base.filter((a) => !k || a.species === k).length;
  const speciesOpts = [{ value: null, label: 'Все', count: spCount(null) }, ...SPECIES_LIST.map((s) => ({ value: s.key, label: s.many, icon: s.icon, count: spCount(s.key) }))];
  const groupOpts = species
    ? [{ value: null, label: 'Все группы' }, ...SPECIES[species].groups.map((g) => ({ value: g.key, label: g.many, count: base.filter((a) => a.species === species && a.group === g.key).length })).filter((g) => g.count > 0 || g.value === group)]
    : [];

  return (
    <div className="screen">
      <div className="hero hero-small">
        <div className="hero-row">
          <h1>Животные</h1>
          <Button kind="primary" icon="plus" size="sm" onClick={() => go(`/animal/new${species ? '?species=' + species : ''}`)}>Добавить</Button>
        </div>
      </div>
      <main className="content">
        <SearchBox value={q} onChange={(v) => { setQ(v); setLimit(PAGE); }} onEnter={() => list.length === 1 && go(`/animal/${list[0].id}`)} />
        <Chips options={speciesOpts} value={species} onChange={(v) => { setSpecies(v); setGroup(null); setLimit(PAGE); }} wrap={false} />
        {species && groupOpts.length > 2 && <Chips options={groupOpts} value={group} onChange={(v) => { setGroup(v); setLimit(PAGE); }} wrap={false} />}
        <Segmented
          options={[{ value: 'active', label: 'На хозяйстве' }, { value: 'out', label: 'Выбыли' }, { value: 'all', label: 'Все' }]}
          value={status}
          onChange={(v) => { setStatus(v); setLimit(PAGE); }}
        />
        {animals && (
          <div className="pill-note">
            Показано: <b>{heads(list.length)}</b>
          </div>
        )}
        {animals && list.length === 0 ? (
          q ? (
            <Empty icon="search" title={`Бирки ${q} не нашлось`} text="Проверьте номер или поменяйте фильтры выше.">
              <Button icon="plus" onClick={() => go(`/animal/new?tag=${q}${species ? '&species=' + species : ''}`)}>Добавить с биркой {q}</Button>
            </Empty>
          ) : (
            <Empty title="Здесь пока пусто" text="Добавьте животное кнопкой «Добавить» вверху." />
          )
        ) : (
          <div className="list">
            {list.slice(0, limit).map((a) => <AnimalRow key={a.id} a={a} showSpecies={!species} onClick={() => go(`/animal/${a.id}`)} />)}
          </div>
        )}
        {list.length > limit && <Button block onClick={() => setLimit(limit + PAGE)}>Показать ещё ({list.length - limit})</Button>}
      </main>
    </div>
  );
}
