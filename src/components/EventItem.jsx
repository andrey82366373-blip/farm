import Icon from './Icon.jsx';
import { Tag } from './ui.jsx';
import { EVENT_TYPES, causeLabel, vetLabel, groupName, SPECIES } from '../lib/domain.js';
import { fmtDate, fmtRub, fmtNum } from '../lib/format.js';

// Текст события по-человечески: «Падёж: холод», «Группа: ягнёнок → ярка».
export function eventText(e, a) {
  const d = e.data || {};
  const sp = a ? SPECIES[a.species] : null;
  switch (e.type) {
    case 'birth':
      return {
        title: a?.sex === 'm' ? 'Родился' : 'Родилась',
        sub: [a?.motherTag ? `мать ${a.motherTag}` : null, d.litter > 1 ? `в помёте ${d.litter}` : null].filter(Boolean).join(', '),
      };
    case 'purchase':
      return { title: 'Покупка', sub: [d.seller, d.price ? fmtRub(d.price) : null].filter(Boolean).join(', ') };
    case 'death':
      return { title: `Падёж: ${causeLabel(d.cause).toLowerCase()}`, sub: d.note };
    case 'slaughter':
      return { title: 'Забой', sub: [d.weight ? `${fmtNum(d.weight)} кг` : null, d.note].filter(Boolean).join(', ') };
    case 'vet':
      return { title: vetLabel(d.kind), sub: [d.drug, d.note].filter(Boolean).join(', ') };
    case 'sale':
      return { title: 'Продажа', sub: d.buyer ? `покупатель: ${d.buyer}` : '' };
    case 'group':
      return { title: 'Смена группы', sub: a ? `${groupName(a.species, d.from).toLowerCase()} → ${groupName(a.species, d.to).toLowerCase()}` : '' };
    case 'tag':
      return { title: d.from ? `Бирка: ${d.from} → ${d.to}` : `Присвоена бирка ${d.to}`, sub: '' };
    case 'note':
      return { title: 'Заметка', sub: d.note };
    default:
      return { title: EVENT_TYPES[e.type]?.label ?? 'Событие', sub: sp?.one ?? '' };
  }
}

export function EventIcon({ type }) {
  const t = EVENT_TYPES[type] ?? EVENT_TYPES.note;
  return <span className={`ev-ico tone-${t.tone}`}><Icon name={t.icon} /></span>;
}

export default function EventItem({ e, a, showAnimal, onClick, right }) {
  const { title, sub } = eventText(e, a);
  const Tagname = onClick ? 'button' : 'div';
  return (
    <Tagname className={`ev ${onClick ? 'press' : ''}`} onClick={onClick}>
      <EventIcon type={e.type} />
      <span className="ev-main">
        <span className="ev-title">{title}</span>
        {showAnimal && a && (
          <span className="ev-animal"><Tag tag={a.tag} size="sm" /> {SPECIES[a.species].one.toLowerCase()}, {groupName(a.species, a.group).toLowerCase()}</span>
        )}
        {sub && <span className="ev-sub">{sub}</span>}
      </span>
      <span className="ev-date">{fmtDate(e.date)}</span>
      {right}
    </Tagname>
  );
}
