import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { back } from '../lib/router.js';
import { SPECIES } from '../lib/domain.js';

/* ---------- Каркас экрана ---------- */
export function TopBar({ title, sub, backTo = '/', right }) {
  return (
    <header className="topbar">
      <button className="topbar-back press" onClick={() => back(backTo)} aria-label="Назад">
        <Icon name="back" />
      </button>
      <div className="topbar-title">
        <h1>{title}</h1>
        {sub && <div className="topbar-sub">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

export function Screen({ title, sub, backTo, right, children, className = '', footer }) {
  return (
    <div className={`screen ${className}`}>
      {title !== undefined && <TopBar title={title} sub={sub} backTo={backTo} right={right} />}
      <main className="content">{children}</main>
      {footer && <div className="footer-bar">{footer}</div>}
    </div>
  );
}

/* ---------- Кнопки ---------- */
export function Button({ children, icon, kind = 'plain', size, block, className = '', ...rest }) {
  return (
    <button className={`btn btn-${kind} ${size ? 'btn-' + size : ''} ${block ? 'btn-block' : ''} press ${className}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
    </button>
  );
}

/* ---------- Бирка ---------- */
export function Tag({ tag, size, className = '' }) {
  if (!tag) return <span className={`tagbadge tagbadge-none ${size ? 'tagbadge-' + size : ''} ${className}`}>без бирки</span>;
  return <span className={`tagbadge ${size ? 'tagbadge-' + size : ''} ${className}`}>{tag}</span>;
}

export function SpeciesIcon({ species, size = 'md' }) {
  return (
    <span className={`sp-ico sp-ico-${species} sp-ico-${size}`}>
      <Icon name={SPECIES[species]?.icon ?? 'sheep'} />
    </span>
  );
}

/* ---------- Выбор ---------- */
export function Chips({ options, value, onChange, className = '', wrap = true }) {
  return (
    <div className={`chips ${wrap ? '' : 'chips-scroll'} ${className}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          className={`chip press ${value === o.value ? 'on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} />}
          <span>{o.label}</span>
          {o.count !== undefined && <b className="chip-count">{o.count}</b>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`seg ${className}`} role="radiogroup" style={{ '--n': options.length }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          className={`seg-btn press ${value === o.value ? 'on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SpeciesPicker({ value, onChange, counts }) {
  return (
    <div className="species-pick">
      {Object.values(SPECIES).map((s) => (
        <button key={s.key} className={`species-tile press ${value === s.key ? 'on' : ''}`} onClick={() => onChange(s.key)} aria-pressed={value === s.key}>
          <SpeciesIcon species={s.key} size="lg" />
          <span>{s.many}</span>
          {counts && <b>{counts[s.key] ?? 0}</b>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Поля ---------- */
export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      {label && <label className="field-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && !error && <div className="field-hint">{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder = 'Номер бирки', autoFocus, id, onEnter }) {
  return (
    <input
      id={id}
      className="input input-tag"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
    />
  );
}

export function SearchBox({ value, onChange, placeholder = 'Найти по бирке', autoFocus, onEnter, id = 'search' }) {
  return (
    <div className="searchbox">
      <Icon name="search" />
      <input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      />
      {value && (
        <button className="searchbox-clear press" onClick={() => onChange('')} aria-label="Очистить">
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

/* ---------- Пустое состояние, карточки ---------- */
export function Empty({ icon = 'sheep', title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} /></div>
      <div className="empty-title">{title}</div>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`section ${className}`}>
      {(title || action) && (
        <div className="section-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Нижняя шторка ---------- */
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="sheet-close press" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Подтверждение и всплывающие сообщения ---------- */
const UiCtx = createContext(null);

export function UiProvider({ children }) {
  const [dlg, setDlg] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const confirm = useCallback((opts) => new Promise((resolve) => setDlg({ ...opts, resolve })), []);
  const notify = useCallback((text, kind = 'ok') => {
    clearTimeout(timer.current);
    setToast({ text, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  const close = (v) => { dlg?.resolve(v); setDlg(null); };

  return (
    <UiCtx.Provider value={{ confirm, notify }}>
      {children}
      {dlg && (
        <div className="sheet-wrap" onClick={() => close(false)}>
          <div className="sheet dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {dlg.icon && <div className={`dialog-ico ${dlg.danger ? 'danger' : ''}`}><Icon name={dlg.icon} /></div>}
            <h2>{dlg.title}</h2>
            {dlg.text && <p>{dlg.text}</p>}
            <div className="dialog-actions">
              <Button kind={dlg.danger ? 'danger' : 'primary'} size="lg" block onClick={() => close(true)}>{dlg.ok ?? 'Да'}</Button>
              {dlg.cancel !== false && <Button size="lg" block onClick={() => close(false)}>{dlg.cancel ?? 'Отмена'}</Button>}
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
          <Icon name={toast.kind === 'error' ? 'warning' : 'check'} />
          <span>{toast.text}</span>
        </div>
      )}
    </UiCtx.Provider>
  );
}

export const useUi = () => useContext(UiCtx);

// Выполнить действие и показать понятную ошибку, если что-то не так.
export function useAction() {
  const { notify } = useUi();
  return useCallback(async (fn, okText) => {
    try {
      const r = await fn();
      if (okText) notify(okText);
      return r ?? true;
    } catch (e) {
      console.error(e);
      notify(e?.message || 'Не получилось сохранить. Попробуйте ещё раз.', 'error');
      return false;
    }
  }, [notify]);
}

/* ---------- Дата с быстрыми кнопками ---------- */
export function DateField({ label = 'Дата', value, onChange, id = 'date' }) {
  const t = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayIso = iso(t);
  const y = new Date(t); y.setDate(t.getDate() - 1);
  const yIso = iso(y);
  return (
    <Field label={label} htmlFor={id}>
      <div className="date-quick">
        <button className={`chip press ${value === todayIso ? 'on' : ''}`} onClick={() => onChange(todayIso)}>Сегодня</button>
        <button className={`chip press ${value === yIso ? 'on' : ''}`} onClick={() => onChange(yIso)}>Вчера</button>
      </div>
      <input id={id} className="input" type="date" max={todayIso} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </Field>
  );
}

/* ---------- Выбранные животные ---------- */
export function PickedSummary({ animals, onEdit, title }) {
  const shown = animals.slice(0, 40);
  return (
    <div className="card picked">
      <div className="picked-head">
        <span className="row-title">{title ?? 'Выбрано'}: {animals.length}</span>
        {onEdit && <Button size="sm" icon="edit" onClick={onEdit}>Изменить</Button>}
      </div>
      <div className="picked-tags">
        {shown.map((a) => <Tag key={a.id} tag={a.tag} size="sm" />)}
        {animals.length > shown.length && <span className="muted">и ещё {animals.length - shown.length}</span>}
      </div>
    </div>
  );
}
