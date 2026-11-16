import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveAnimal, findTagOwner, findNameOwner, resolveMother, cleanTag, getDefaultBrand } from '../lib/db.js';
import { SPECIES, groupOf, groupName, usesBrand } from '../lib/domain.js';
import { today, toISO, parseISO, monthsBetween, fmtAge } from '../lib/format.js';
import { go, back, useRoute } from '../lib/router.js';
import { Screen, Field, TagInput, IdInput, Chips, Segmented, SpeciesPicker, Button, useAction, useUi } from '../components/ui.jsx';
import { shrinkPhoto, usePhoto, useBlobUrl } from '../lib/photo.js';

function emptyForm(species = 'sheep', tag = '') {
  return {
    species, tag, group: SPECIES[species].groups[0].key, sex: 'f',
    birthMode: 'date', birthDate: '', approxYears: '', approxMonths: '',
    motherTag: '', color: '', notes: '', name: '', brand: getDefaultBrand(), chip: '',
  };
}

function fromAnimal(a) {
  let birthMode = a.birthDate ? (a.birthApprox ? 'approx' : 'date') : 'none';
  let approxYears = '', approxMonths = '';
  if (a.birthApprox && a.birthDate) {
    const m = monthsBetween(a.birthDate, today());
    approxYears = String(Math.floor(m / 12) || '');
    approxMonths = String(m % 12 || '');
  }
  return { ...emptyForm(a.species), ...a, name: a.name || '', brand: a.brand ?? getDefaultBrand(), chip: a.chip || '', birthMode, approxYears, approxMonths, birthDate: a.birthDate || '', motherTag: a.motherTag || '' };
}

function birthFromForm(f) {
  if (f.birthMode === 'date') return { birthDate: f.birthDate || null, birthApprox: false };
  if (f.birthMode === 'approx') {
    const m = (Number(f.approxYears) || 0) * 12 + (Number(f.approxMonths) || 0);
    if (!m) return { birthDate: null, birthApprox: false };
    const d = parseISO(today());
    d.setMonth(d.getMonth() - m);
    return { birthDate: toISO(d), birthApprox: true };
  }
  return { birthDate: null, birthApprox: false };
}

// Добавление и изменение животного.
export default function AnimalForm({ id }) {
  const { query } = useRoute();
  const existing = useLiveQuery(() => (id ? db.animals.get(id) : null), [id]);
  const [f, setF] = useState(() => ({ ...emptyForm(query.species || 'sheep', query.tag || ''), name: query.name || '' }));
  const [nameOwner, setNameOwner] = useState(null);
  const [loaded, setLoaded] = useState(!id);
  const [photo, setPhoto] = useState(undefined); // undefined — не менялось, null — убрать
  const [tagOwner, setTagOwner] = useState(null);
  const [mother, setMother] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const run = useAction();
  const { notify } = useUi();
  const oldPhoto = usePhoto(id);
  const newPhoto = useBlobUrl(photo || null);
  const photoUrl = photo === null ? null : newPhoto || oldPhoto;

  useEffect(() => {
    if (existing && !loaded) { setF(fromAnimal(existing)); setLoaded(true); }
  }, [existing, loaded]);

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const sp = SPECIES[f.species];
  const g = groupOf(f.species, f.group);
  const brandSp = usesBrand(f.species);

  // Проверяем бирку и мать прямо во время ввода.
  useEffect(() => {
    let alive = true;
    findTagOwner(f.species, f.tag, id).then((o) => alive && setTagOwner(existing && existing.status !== 'active' ? null : o));
    return () => { alive = false; };
  }, [f.species, f.tag, id, existing]);
  useEffect(() => {
    let alive = true;
    findNameOwner(f.species, f.name, id).then((o) => alive && setNameOwner(existing && existing.status !== 'active' ? null : o));
    return () => { alive = false; };
  }, [f.species, f.name, id, existing]);
  useEffect(() => {
    let alive = true;
    resolveMother(f.species, f.motherTag).then((m) => alive && setMother(m && m.id !== id ? m : null));
    return () => { alive = false; };
  }, [f.species, f.motherTag, id]);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPhoto(await shrinkPhoto(file)); } catch { notify('Не удалось открыть фото', 'error'); }
  };

  const save = async (next) => {
    if (tagOwner || nameOwner) return;
    setSaving(true);
    const data = {
      id: id || undefined, species: f.species, tag: f.tag, group: f.group,
      name: f.name, brand: f.brand, chip: f.chip,
      sex: g?.sex ?? f.sex, ...birthFromForm(f),
      motherTag: f.motherTag, motherId: mother?.id ?? null,
      color: f.color, notes: f.notes, demo: existing?.demo,
    };
    const newId = await run(() => saveAnimal(data, photo), id ? 'Изменения сохранены' : `Добавлено: ${sp.one.toLowerCase()} ${f.name.trim() || cleanTag(f.tag) || ''}`);
    setSaving(false);
    if (!newId) return;
    if (next) {
      // «Сохранить и следующее»: оставляем вид и группу, очищаем остальное.
      setF({ ...emptyForm(f.species), group: f.group, sex: f.sex, brand: f.brand });
      setPhoto(undefined);
      window.scrollTo(0, 0);
    } else if (id) back(`/animal/${id}`);
    else go(`/animal/${newId}`, { replace: true });
  };

  if (!loaded) return <Screen title="Загрузка…" />;

  const groupOpts = sp.groups.map((x) => ({ value: x.key, label: x.one }));

  return (
    <Screen
      title={id ? 'Изменить' : 'Новое животное'}
      sub={id ? `${sp.one} ${existing?.name || existing?.tag || ''}` : null}
      backTo={id ? `/animal/${id}` : '/animals'}
      className="with-footer"
      footer={
        <>
          <Button kind="primary" size="lg" block icon="check" disabled={saving || !!tagOwner || !!nameOwner} onClick={() => save(false)}>Сохранить</Button>
          {!id && <Button kind="ghost" disabled={saving || !!tagOwner || !!nameOwner} onClick={() => save(true)}>Сохранить и добавить ещё</Button>}
        </>
      }
    >
      <div className="form">
        {!id && (
          <Field label="Вид">
            <SpeciesPicker value={f.species} onChange={(s) => set({ species: s, group: SPECIES[s].groups[0].key })} />
          </Field>
        )}

        {brandSp && (
          <>
            <Field
              label="Кличка или номер"
              htmlFor="name"
              error={nameOwner ? `«${nameOwner.name}» уже есть на хозяйстве (${groupName(nameOwner.species, nameOwner.group).toLowerCase()}).` : null}
              hint="То, по чему вы её различаете: Зорька, Рыжая, 7."
            >
              <IdInput id="name" value={f.name} onChange={(v) => set({ name: v })} placeholder="Кличка или номер" />
            </Field>
            <Field label="Тавро" htmlFor="brand" hint="Буква или знак клейма. Если тавра нет, сотрите.">
              <input id="brand" className="input input-brand" value={f.brand} maxLength={4} onChange={(e) => set({ brand: e.target.value })} autoComplete="off" />
            </Field>
          </>
        )}

        <Field
          label={brandSp ? 'Номер бирки (если есть)' : 'Номер бирки'}
          htmlFor="tag"
          error={tagOwner ? `Бирка ${tagOwner.tag} уже есть у другого животного (${groupName(tagOwner.species, tagOwner.group).toLowerCase()}).` : null}
          hint={brandSp ? 'Необязательно.' : 'Только цифры. Можно оставить пустым и присвоить бирку позже.'}
        >
          <TagInput id="tag" value={f.tag} onChange={(v) => set({ tag: v })} />
        </Field>

        <Field label="Группа">
          <Chips options={groupOpts} value={f.group} onChange={(v) => set({ group: v })} />
        </Field>

        {g && g.sex === null && (
          <Field label="Пол">
            <Segmented options={[{ value: 'f', label: sp.babyLabel.f, icon: 'female' }, { value: 'm', label: sp.babyLabel.m, icon: 'male' }]} value={f.sex} onChange={(v) => set({ sex: v })} />
          </Field>
        )}

        <Field label="Возраст">
          <Segmented
            options={[{ value: 'date', label: 'Дата рождения' }, { value: 'approx', label: 'Примерно' }, { value: 'none', label: 'Не знаю' }]}
            value={f.birthMode}
            onChange={(v) => set({ birthMode: v })}
          />
          {f.birthMode === 'date' && (
            <input id="birthDate" className="input" type="date" max={today()} value={f.birthDate} onChange={(e) => set({ birthDate: e.target.value })} aria-label="Дата рождения" />
          )}
          {f.birthMode === 'approx' && (
            <div className="input-row">
              <div className="input-unit">
                <input id="approxYears" className="input" inputMode="numeric" placeholder="0" value={f.approxYears} onChange={(e) => set({ approxYears: e.target.value.replace(/\D/g, '') })} aria-label="Лет" />
                <span>лет</span>
              </div>
              <div className="input-unit">
                <input id="approxMonths" className="input" inputMode="numeric" placeholder="0" value={f.approxMonths} onChange={(e) => set({ approxMonths: e.target.value.replace(/\D/g, '').slice(0, 2) })} aria-label="Месяцев" />
                <span>мес.</span>
              </div>
            </div>
          )}
          {f.birthMode === 'date' && f.birthDate && <div className="field-hint">Сейчас: {fmtAge(f.birthDate, false)}</div>}
        </Field>

        <Field
          label={brandSp ? 'Мать (кличка или номер)' : 'Мать (номер бирки)'}
          htmlFor="motherTag"
          hint={f.motherTag ? (mother ? `Нашлась: ${groupName(mother.species, mother.group).toLowerCase()}${mother.birthDate ? ', ' + fmtAge(mother.birthDate, mother.birthApprox) : ''}` : 'В списке такой нет, сохраню как написано.') : 'Если известна.'}
        >
          <IdInput id="motherTag" numeric={!brandSp} value={f.motherTag} onChange={(v) => set({ motherTag: brandSp ? v : v.replace(/\D/g, '') })} placeholder={brandSp ? 'Кличка матери' : 'Бирка матери'} />
        </Field>

        <Field label="Окрас, приметы" htmlFor="color">
          <input id="color" className="input" value={f.color} onChange={(e) => set({ color: e.target.value })} placeholder="Например: белая, чёрное пятно на ухе" />
        </Field>

        <Field label="Заметки" htmlFor="notes">
          <textarea id="notes" className="textarea" value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Всё, что важно помнить" />
        </Field>

        <Field label="Номер чипа" htmlFor="chip" hint="Необязательно. Если животное чипировано.">
          <TagInput id="chip" value={f.chip} onChange={(v) => set({ chip: v })} placeholder="Чип" />
        </Field>

        <Field label="Фото">
          {photoUrl && <img className="photo-preview" src={photoUrl} alt="Фото животного" />}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          <div className="btn-row">
            <Button icon="camera" onClick={() => fileRef.current.click()}>{photoUrl ? 'Другое фото' : 'Добавить фото'}</Button>
            {photoUrl && <Button icon="trash" onClick={() => setPhoto(null)}>Убрать</Button>}
          </div>
        </Field>
      </div>
    </Screen>
  );
}
