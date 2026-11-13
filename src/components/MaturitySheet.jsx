import { Sheet, Button, Tag, useUi, useAction } from './ui.jsx';
import { changeGroup, snoozeMaturity } from '../lib/db.js';
import { groupOf, SPECIES } from '../lib/domain.js';
import { maturityTitle, snoozeDate } from '../lib/data.js';
import { fmtAge, fmtDate } from '../lib/format.js';
import { go } from '../lib/router.js';

// Напоминание о взрослении: папа подтверждает перевод одной кнопкой.
export default function MaturitySheet({ group, onClose }) {
  const { confirm } = useUi();
  const run = useAction();
  if (!group) return null;
  const sp = SPECIES[group.species];
  const many = (k) => groupOf(group.species, k)?.many.toLowerCase();
  const one = (k) => groupOf(group.species, k)?.one.toLowerCase();

  const moveOne = async (d, to) => {
    const ok = await confirm({
      icon: 'arrowUp', title: `Перевести в ${many(to)}?`,
      text: `${sp.one} с биркой ${d.animal.tag || '(без бирки)'} станет: ${one(to)}.`, ok: 'Перевести',
    });
    if (ok) await run(() => changeGroup([d.animal.id], to), `Готово: ${one(to)}`);
  };

  // «Всех сразу» — только когда вариант один (иначе у самцов надо выбирать).
  const bySex = {};
  for (const d of group.items) (bySex[d.options[0]] ||= []).push(d);
  const moveAll = async () => {
    const parts = Object.entries(bySex).map(([to, list]) => `${list.length} → ${many(to)}`).join(', ');
    const ok = await confirm({ icon: 'arrowUp', title: `Перевести всех (${group.items.length})?`, text: parts, ok: 'Перевести всех' });
    if (!ok) return;
    await run(async () => {
      for (const [to, list] of Object.entries(bySex)) await changeGroup(list.map((d) => d.animal.id), to);
    }, 'Группы обновлены');
    onClose();
  };
  const snooze = async () => {
    await run(() => snoozeMaturity(group.items.map((d) => d.animal.id), snoozeDate()), `Напомню ${fmtDate(snoozeDate())}`);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={maturityTitle(group)}>
      <p className="muted">
        {group.items[0].reason === 'birth'
          ? 'У этих самок уже были роды. Пора перевести их во взрослую группу.'
          : 'Эти животные подросли по возрасту. Проверьте и переведите.'}
      </p>
      <div className="list">
        {group.items.map((d) => (
          <div key={d.animal.id} className="card mat-item">
            <button className="mat-head press" onClick={() => { onClose(); go(`/animal/${d.animal.id}`); }}>
              <Tag tag={d.animal.tag} />
              <span className="row-main">
                <span className="row-title">{sp.babyLabel[d.animal.sex] && group.from === sp.newborn ? sp.babyLabel[d.animal.sex] : groupOf(group.species, group.from)?.one}</span>
                <span className="row-sub">{fmtAge(d.animal.birthDate, d.animal.birthApprox) || 'возраст не указан'}</span>
              </span>
            </button>
            <div className="mat-btns">
              {d.options.map((to) => (
                <Button key={to} size="sm" kind={to === d.options[0] ? 'primary' : 'plain'} icon="arrowUp" onClick={() => moveOne(d, to)}>
                  {groupOf(group.species, to)?.one}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {group.items.length > 1 && (
        <Button kind="primary" size="lg" block icon="check" onClick={moveAll}>
          {`Всех в ${many(group.options[0])} (${group.items.length})`}
        </Button>
      )}
      <Button block onClick={snooze}>Напомнить через месяц</Button>
    </Sheet>
  );
}
