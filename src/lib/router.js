import { useEffect, useState, useSyncExternalStore } from 'react';

// Простая навигация по адресу после «#»: #/animal/12, #/sale/new и т. п.
// Кнопка «Назад» на телефоне работает как обычно.

const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

function parse() {
  const s = location.hash.replace(/^#/, '') || '/';
  const [path, q = ''] = s.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(q)), key: s };
}

let current = parse();
function refresh() {
  current = parse();
  emit();
}

if (!history.state || typeof history.state.d !== 'number') {
  history.replaceState({ d: 0 }, '', location.href);
}
window.addEventListener('popstate', (e) => {
  refresh();
  const y = e.state?.y ?? 0;
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
});
window.addEventListener('hashchange', () => {
  if (parse().key !== current.key) refresh();
});

export function go(to, { replace = false } = {}) {
  const d = history.state?.d ?? 0;
  history.replaceState({ ...history.state, y: window.scrollY }, '');
  const url = '#' + to;
  if (replace) history.replaceState({ d }, '', url);
  else history.pushState({ d: d + 1 }, '', url);
  refresh();
  window.scrollTo(0, 0);
}

export function back(fallback = '/') {
  if ((history.state?.d ?? 0) > 0) history.back();
  else go(fallback, { replace: true });
}

export function useRoute() {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => listeners.delete(f); },
    () => current,
  );
}

// Состояние экрана (фильтры, поиск), которое сохраняется при переходах.
const memory = new Map();
export function useKeep(key, init) {
  const [v, setV] = useState(() => (memory.has(key) ? memory.get(key) : init));
  useEffect(() => { memory.set(key, v); }, [key, v]);
  return [v, setV];
}
