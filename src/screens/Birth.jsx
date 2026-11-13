import { useEffect, useState } from 'react';
import { recordBirth, resolveMother, findTagOwner } from '../lib/db.js';
import { SPECIES, groupOf, groupName } from '../lib/domain.js';
import { today, fmtAge, plural } from '../lib/format.js';
import { go, useRoute } from '../lib/router.js';
import { Screen, Field, TagInput, Segmented, DateField, SpeciesPicker, Button, Tag, useAction } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const newBaby = (sex = 'f') => ({ sex, tag: '', color: '', stillborn: false });

// Рождение: мать, дата и сразу несколько новорождённых.
// Бирку можно ввести сразу или оставить на потом.
export default function Birth() {
  const { query } = useRoute();
  const [species, setSpecies] = useState(query.species || 'sheep');
  const [motherTag, setMotherTag] = useState(query.mother || '');
  const [mother, setMother] = useState(null);
  const [date, setDate] = useState(today());
  const [babies, setBabies] = useState([newBaby()]);
  const [dupes, setDupes] = useState({});
  const [saving, setSaving] = useState(false);
  const run = useAction();
  const sp = SPECIES[species];

  useEffect(() => {
    let alive = true;
    resolveMother(species, motherTag).then((m) => alive && setMother(m));
    return () => { alive = false; };
  }, [species, motherTag]);

  const motherBad = mother && (groupOf(species, mother.group)?.sex === 'm' || mother.status !== 'active');
  const setBaby = async (i, patch) => {
    setBabies((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    if ('tag' in patch) {
      const owner = await findTagOwner(species, patch.tag);
      setDupes((d) => ({ ...d, [i]: owner ? patch.tag : null }));
    }
  };
  const hasDupes = Object.values(dupes).some(Boolean);

  const save = async (next) => {
    setSaving(true);
    const ok = await run(
      () => recordBirth({ species, motherId: mother && !motherBad ? mother.id : null, motherTag, date, babies }),
      `Записано: ${babies.length} ${plural(babies.length, 'новорождённый', 'новорождённых', 'новорождённых')}`,
    );
    setSaving(false);
    if (!ok) return;
    if (next) {
      setMotherTag('');
      setBabies([newBaby()]);
      setDupes({});
      window.scrollTo(0, 0);
    } else if (mother && !motherBad) go(`/animal/${mother.id}`, { replace: true });
    else go('/', { replace: true });
  };

  const alive = babies.filter((b) => !b.stillborn).length;

  return (
    <Screen
      title="Родились"
      sub={sp.birthWord}
      className="with-footer"
      footer={
        <>
          <Button kind="primary" size="lg" block icon="check" disabled={saving || hasDupes || motherBad} onClick={() => save(false)}>
            Записать: {babies.length} {plural(babies.length, 'детёныш', 'детёныша', 'детёнышей')}
          </Button>
          <Button kind="ghost" disabled={saving || hasDupes || motherBad} onClick={() => save(true)}>Записать и следующие роды</Button>
        </>
      }
    >
      <div className="form">
        <Field label="Вид"><SpeciesPicker value={species} onChange={(s) => { setSpecies(s); setDupes({}); }} /></Field>

        <Field label="Мать (номер бирки)" htmlFor="motherTag" hint={!motherTag ? 'Если мать неизвестна, оставьте пустым.' : null}>
          <TagInput id="motherTag" value={motherTag} onChange={setMotherTag} placeholder="Бирка матери" />
          {motherTag && (mother ? (
            motherBad ? (
              <div className="mother-found bad"><Icon name="warning" />Бирка {mother.tag}: {groupName(species, mother.group).toLowerCase()}{mother.status !== 'active' ? ', не на хозяйстве' : ''}. Проверьте номер.</div>
            ) : (
              <div className="mother-found">
                <Tag tag={mother.tag} />
                <span>{groupName(species, mother.group)}{mother.birthDate ? `, ${fmtAge(mother.birthDate, mother.birthApprox)}` : ''}</span>
              </div>
            )
          ) : (
            <div className="field-hint">Такой бирки нет в списке. Номер матери просто сохранится в карточках детёнышей.</div>
          ))}
        </Field>

        <DateField value={date} onChange={setDate} />

        <Field label={`Новорождённые: ${babies.length}`}>
          <div className="list">
            {babies.map((b, i) => (
              <div key={i} className={`card baby ${b.stillborn ? 'dead' : ''}`}>
                <div className="baby-head">
                  <b>{i + 1}-й</b>
                  {babies.length > 1 && <Button size="sm" icon="close" onClick={() => { setBabies(babies.filter((_, j) => j !== i)); setDupes({}); }}>Убрать</Button>}
                </div>
                <Segmented
                  options={[{ value: 'f', label: sp.babyLabel.f, icon: 'female' }, { value: 'm', label: sp.babyLabel.m, icon: 'male' }]}
                  value={b.sex}
                  onChange={(v) => setBaby(i, { sex: v })}
                />
                <Segmented
                  options={[{ value: false, label: 'Живой' }, { value: true, label: 'Мёртвый' }]}
                  value={b.stillborn}
                  onChange={(v) => setBaby(i, { stillborn: v, ...(v ? { tag: '' } : {}) })}
                />
                {!b.stillborn && (
                  <>
                    <TagInput id={`babyTag${i}`} value={b.tag} onChange={(v) => setBaby(i, { tag: v })} placeholder="Бирка (можно позже)" />
                    {dupes[i] && <div className="field-error">Бирка {dupes[i]} уже есть на хозяйстве</div>}
                    <input id={`babyColor${i}`} className="input" value={b.color} onChange={(e) => setBaby(i, { color: e.target.value })} placeholder="Окрас, приметы" />
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="btn-row">
            <Button icon="plus" onClick={() => setBabies([...babies, newBaby('f')])}>{sp.babyLabel.f}</Button>
            <Button icon="plus" onClick={() => setBabies([...babies, newBaby('m')])}>{sp.babyLabel.m}</Button>
          </div>
        </Field>
        {babies.length > 1 && <p className="pill-note">Живых: {alive}, мёртвых: {babies.length - alive}</p>}
      </div>
    </Screen>
  );
}
