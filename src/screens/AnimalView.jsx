import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteAnimal, assignTag, undoOut, addNote, changeGroup, deleteEvent, byDateDesc } from '../lib/db.js';
import { SPECIES, groupName, sexLabel, STATUS } from '../lib/domain.js';
import { fmtAge, fmtDate, today, plural } from '../lib/format.js';
import { go, back } from '../lib/router.js';
import { Screen, Tag, SpeciesIcon, Button, Section, Sheet, Field, TagInput, Chips, Empty, useUi, useAction } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import AnimalRow, { StatusBadge } from '../components/AnimalRow.jsx';
import EventItem from '../components/EventItem.jsx';
import { usePhoto } from '../lib/photo.js';

const DELETABLE = new Set(['vet', 'note', 'group', 'tag']);

export default function AnimalView({ id }) {
  const a = useLiveQuery(() => db.animals.get(id), [id]);
  const events = useLiveQuery(() => db.events.where({ animalId: id }).toArray(), [id]);
  const kids = useLiveQuery(() => db.animals.where({ motherId: id }).toArray(), [id]);
  const mother = useLiveQuery(() => (a?.motherId ? db.animals.get(a.motherId) : null), [a?.motherId]);
  const photo = usePhoto(id);
  const { confirm } = useUi();
  const run = useAction();
  const [sheet, setSheet] = useState(null);
  const [tagVal, setTagVal] = useState('');
  const [note, setNote] = useState('');

  const history = useMemo(() => {
    if (!events || !kids) return [];
    // роды у матери показываем одной строкой на дату
    const births = new Map();
    for (const k of kids) {
      if (!k.birthDate) continue;
      if (!births.has(k.birthDate)) births.set(k.birthDate, []);
      births.get(k.birthDate).push(k);
    }
    const birthRows = [...births.entries()].map(([date, list]) => ({ id: `b${date}`, type: 'motherBirth', date, list }));
    return [...events, ...birthRows].sort(byDateDesc);
  }, [events, kids]);

  if (a === undefined) return <Screen title="" />;
  if (a === null) {
    return (
      <Screen title="Животное">
        <Empty icon="warning" title="Животное не найдено" text="Возможно, его удалили.">
          <Button onClick={() => go('/animals', { replace: true })}>К списку</Button>
        </Empty>
      </Screen>
    );
  }

  const sp = SPECIES[a.species];
  const active = a.status === 'active';
  const sold = history.find((e) => e.type === 'sale');

  const doAssignTag = async () => {
    const ok = await run(() => assignTag(id, tagVal), `Бирка ${tagVal} присвоена`);
    if (ok) { setSheet(null); setTagVal(''); }
  };
  const doNote = async () => {
    if (!note.trim()) return;
    const ok = await run(() => addNote(id, { date: today(), note: note.trim() }), 'Заметка записана');
    if (ok) { setSheet(null); setNote(''); }
  };
  const doGroup = async (to) => {
    const ok = await confirm({ icon: 'arrowUp', title: `Перевести в группу «${groupName(a.species, to)}»?`, ok: 'Перевести' });
    if (ok && (await run(() => changeGroup([id], to), 'Группа изменена'))) setSheet(null);
  };
  const doUndoOut = async () => {
    const ok = await confirm({ icon: 'undo', title: 'Вернуть на хозяйство?', text: `Запись «${STATUS[a.status].label}» будет удалена, животное снова будет в поголовье.`, ok: 'Вернуть' });
    if (ok) await run(() => undoOut(id), 'Животное снова на хозяйстве');
  };
  const doDelete = async () => {
    const ok = await confirm({
      icon: 'trash', danger: true, title: 'Удалить животное совсем?',
      text: 'Карточка и вся его история пропадут. Если животное продано, пало или забито — не удаляйте, а запишите это событием.',
      ok: 'Удалить навсегда',
    });
    if (ok && (await run(() => deleteAnimal(id), 'Животное удалено'))) back('/animals');
  };
  const doDeleteEvent = async (e) => {
    const ok = await confirm({ icon: 'trash', danger: true, title: 'Удалить эту запись?', ok: 'Удалить' });
    if (ok) await run(() => deleteEvent(e.id), 'Запись удалена');
  };

  return (
    <Screen
      title={`${sp.one}${a.tag ? ' ' + a.tag : ''}`}
      sub={groupName(a.species, a.group)}
      backTo="/animals"
      right={<button className="icon-btn press" onClick={() => go(`/animal/${id}/edit`)} aria-label="Изменить"><Icon name="edit" /></button>}
    >
      <div className="card animal-hero">
        {photo && <img className="animal-photo" src={photo} alt={`Фото: ${sp.one.toLowerCase()} ${a.tag}`} />}
        <div className="animal-id">
          <Tag tag={a.tag} size="lg" />
          <SpeciesIcon species={a.species} size="lg" />
        </div>
        <div className="animal-status">
          <StatusBadge status={a.status} />
          {a.outDate && <span className="muted">{fmtDate(a.outDate, { year: true })}</span>}
        </div>
        {!a.tag && active && <Button kind="tag" icon="tag" block onClick={() => setSheet('tag')}>Присвоить бирку</Button>}
        <dl className="kv">
          <dt>Группа</dt><dd>{groupName(a.species, a.group)}</dd>
          <dt>Пол</dt><dd>{sexLabel(a.species, a.sex, a.group) || '—'}</dd>
          <dt>Возраст</dt><dd>{a.birthDate ? fmtAge(a.birthDate, a.birthApprox, a.outDate || today()) : 'не указан'}</dd>
          {a.birthDate && !a.birthApprox && <><dt>Родил{a.sex === 'm' ? 'ся' : 'ась'}</dt><dd>{fmtDate(a.birthDate, { year: true })}</dd></>}
          <dt>Мать</dt>
          <dd>
            {mother ? (
              <button className="link press" onClick={() => go(`/animal/${mother.id}`)}><Tag tag={mother.tag} size="sm" /> {groupName(mother.species, mother.group).toLowerCase()}</button>
            ) : a.motherTag ? `бирка ${a.motherTag}` : 'неизвестна'}
          </dd>
          {a.color && <><dt>Приметы</dt><dd>{a.color}</dd></>}
        </dl>
        {a.notes && <p className="animal-notes">{a.notes}</p>}
      </div>

      {active ? (
        <div className="quick">
          <button className="quick-btn press" onClick={() => go(`/event/vet?ids=${id}`)}><Icon name="vet" />Ветеринар</button>
          <button className="quick-btn press" onClick={() => setSheet('note')}><Icon name="note" />Заметка</button>
          <button className="quick-btn press" onClick={() => setSheet('group')}><Icon name="arrowUp" />Группа</button>
          <button className="quick-btn press" onClick={() => go(`/sale/new?ids=${id}`)}><Icon name="sale" />Продать</button>
          <button className="quick-btn press" onClick={() => go(`/event/death?ids=${id}`)}><Icon name="death" />Падёж</button>
          <button className="quick-btn press" onClick={() => go(`/event/slaughter?ids=${id}`)}><Icon name="meat" />Забой</button>
        </div>
      ) : a.status === 'sold' ? (
        sold?.saleId && <Button icon="sale" block onClick={() => go(`/sale/${sold.saleId}`)}>Открыть продажу</Button>
      ) : (
        <Button icon="undo" block onClick={doUndoOut}>Вернуть на хозяйство</Button>
      )}

      {kids && kids.length > 0 && (
        <Section title={`Приплод: ${kids.length}`}>
          <div className="list">
            {[...kids].sort((x, y) => (x.birthDate < y.birthDate ? 1 : -1)).map((k) => (
              <AnimalRow key={k.id} a={k} showSpecies={false} onClick={() => go(`/animal/${k.id}`)} />
            ))}
          </div>
        </Section>
      )}

      <Section title="История">
        {history.length === 0 ? (
          <p className="muted">Пока нет записей. Здесь появятся рождение, прививки, лечение и другие события.</p>
        ) : (
          <div className="timeline">
            {history.map((e) => e.type === 'motherBirth' ? (
              <div key={e.id} className="ev">
                <span className="ev-ico tone-green"><Icon name="birth" /></span>
                <span className="ev-main">
                  <span className="ev-title">{sp.birthWord}: {e.list.length} {plural(e.list.length, 'детёныш', 'детёныша', 'детёнышей')}</span>
                  <span className="ev-sub">{e.list.map((k) => `${sp.babyLabel[k.sex]?.toLowerCase() ?? ''} ${k.tag || 'без бирки'}${k.status === 'dead' ? ' (пал)' : ''}`).join(', ')}</span>
                </span>
                <span className="ev-date">{fmtDate(e.date)}</span>
              </div>
            ) : (
              <EventItem
                key={e.id}
                e={e}
                a={a}
                onClick={e.type === 'sale' && e.saleId ? () => go(`/sale/${e.saleId}`) : undefined}
                right={DELETABLE.has(e.type) ? <button className="ev-del press" onClick={(ev) => { ev.stopPropagation(); doDeleteEvent(e); }} aria-label="Удалить запись"><Icon name="trash" /></button> : null}
              />
            ))}
          </div>
        )}
      </Section>

      <Button kind="ghost" icon="trash" onClick={doDelete}>Удалить животное</Button>

      <Sheet open={sheet === 'tag'} onClose={() => setSheet(null)} title="Присвоить бирку">
        <Field label="Номер бирки" htmlFor="newTag"><TagInput id="newTag" value={tagVal} onChange={setTagVal} autoFocus onEnter={doAssignTag} /></Field>
        <Button kind="primary" size="lg" block icon="check" disabled={!tagVal} onClick={doAssignTag}>Сохранить бирку</Button>
      </Sheet>
      <Sheet open={sheet === 'note'} onClose={() => setSheet(null)} title="Заметка">
        <textarea id="noteText" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="Что случилось, что заметили" />
        <Button kind="primary" size="lg" block icon="check" disabled={!note.trim()} onClick={doNote}>Записать</Button>
      </Sheet>
      <Sheet open={sheet === 'group'} onClose={() => setSheet(null)} title="Сменить группу">
        <Chips options={sp.groups.map((g) => ({ value: g.key, label: g.one }))} value={a.group} onChange={(v) => v !== a.group && doGroup(v)} />
      </Sheet>
    </Screen>
  );
}
