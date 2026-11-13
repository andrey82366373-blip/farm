import { useEffect, useState } from 'react';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';

const ITEMS = [
  { to: '/calendar', icon: 'calendar', title: 'Календарь', sub: 'Сроки окота и отёла, счётчик дней' },
  { to: '/sales', icon: 'sale', title: 'Продажи', sub: 'Сколько продано и на какую сумму' },
  { to: '/counts', icon: 'tally', title: 'Пересчёты', sub: 'Прошлые пересчёты в поле' },
  { to: '/stats', icon: 'chart', title: 'Статистика', sub: 'Родилось и пало за окот, месяц, год' },
  { to: '/backup', icon: 'shield', title: 'Резервная копия', sub: 'Сохранить или восстановить данные' },
  { to: '/demo', icon: 'flask', title: 'Тестовые данные', sub: 'Загрузить пример или удалить его' },
  { to: '/settings', icon: 'settings', title: 'Настройки', sub: 'Сроки беременности' },
];

// Кнопка «Установить» появляется, когда телефон разрешает поставить приложение.
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });

export default function More() {
  const [canInstall, setCanInstall] = useState(!!installEvent);
  useEffect(() => {
    const f = (e) => { e.preventDefault(); installEvent = e; setCanInstall(true); };
    window.addEventListener('beforeinstallprompt', f);
    return () => window.removeEventListener('beforeinstallprompt', f);
  }, []);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;

  return (
    <div className="screen">
      <div className="hero hero-small"><h1>Ещё</h1></div>
      <main className="content">
        <div className="list">
          {ITEMS.map((it) => (
            <button key={it.to} className="row press" onClick={() => go(it.to)}>
              <span className="row-ico"><Icon name={it.icon} /></span>
              <span className="row-main">
                <span className="row-title">{it.title}</span>
                <span className="row-sub">{it.sub}</span>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
        {!standalone && (
          <div className="card install">
            <div className="row-title">Поставить на экран телефона</div>
            {canInstall ? (
              <button className="btn btn-primary btn-block press" onClick={async () => { await installEvent.prompt(); installEvent = null; setCanInstall(false); }}>
                <Icon name="phone" /><span>Установить приложение</span>
              </button>
            ) : (
              <p className="muted">В Chrome нажмите ⋮ в правом верхнем углу и выберите «Установить приложение» или «Добавить на главный экран».</p>
            )}
          </div>
        )}
        <p className="pill-note center">Всё хранится только в этом телефоне и работает без интернета.</p>
      </main>
    </div>
  );
}
