import Icon from './Icon.jsx';
import { SpeciesIcon, Tag } from './ui.jsx';
import { STATUS, groupName, SPECIES } from '../lib/domain.js';
import { fmtAge } from '../lib/format.js';

export function animalSubtitle(a) {
  const parts = [groupName(a.species, a.group)];
  const age = fmtAge(a.birthDate, a.birthApprox);
  if (age) parts.push(age);
  if (a.color) parts.push(a.color);
  return parts.join(', ');
}

export function StatusBadge({ status }) {
  return <span className={`status status-${status}`}>{STATUS[status]?.label}</span>;
}

// Строка животного в списках. selectable — с галочкой для выбора.
export default function AnimalRow({ a, onClick, selectable, selected, showSpecies = true }) {
  const out = a.status !== 'active';
  return (
    <button className={`row press ${out ? 'out' : ''} ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selectable ? !!selected : undefined}>
      {selectable && <span className="check"><Icon name="check" /></span>}
      <Tag tag={a.tag} />
      <span className="row-main">
        <span className="row-title">{showSpecies ? `${SPECIES[a.species].one}, ` : ''}{groupName(a.species, a.group).toLowerCase()}</span>
        <span className="row-sub">{animalSubtitle(a).split(', ').slice(1).join(', ') || ' '}</span>
      </span>
      {out ? <StatusBadge status={a.status} /> : !selectable && showSpecies && <SpeciesIcon species={a.species} size="sm" />}
      {!selectable && <Icon name="chevron" />}
    </button>
  );
}
