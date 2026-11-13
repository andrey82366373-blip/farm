import { useRoute, go } from './lib/router.js';
import { UiProvider, Empty, Button, Screen } from './components/ui.jsx';
import Icon from './components/Icon.jsx';
import Home from './screens/Home.jsx';
import More from './screens/More.jsx';

const TABS = [
  { path: '/', label: 'Главная', icon: 'home' },
  { path: '/animals', label: 'Животные', icon: 'list' },
  { path: '/journal', label: 'Журнал', icon: 'book' },
  { path: '/more', label: 'Ещё', icon: 'more' },
];

function BottomNav({ path }) {
  const active = TABS.find((t) => t.path === path) ? path : null;
  return (
    <nav className="nav" aria-label="Разделы">
      {TABS.map((t) => (
        <button key={t.path} className={active === t.path ? 'on' : ''} onClick={() => active !== t.path && go(t.path, { replace: !!active })} aria-current={active === t.path ? 'page' : undefined}>
          <Icon name={t.icon} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function NotFound() {
  return (
    <Screen title="Нет такой страницы">
      <Empty icon="warning" title="Страница не найдена" text="Вернитесь на главный экран.">
        <Button kind="primary" onClick={() => go('/', { replace: true })}>На главную</Button>
      </Empty>
    </Screen>
  );
}

function route(r) {
  const [a, b, c] = r.parts;
  switch (a) {
    case undefined: return <Home />;
    case 'more': return <More />;
    default: return <NotFound />;
  }
}

export default function App() {
  const r = useRoute();
  const tab = TABS.some((t) => t.path === r.path);
  return (
    <UiProvider>
      <div className="app">
        <div key={r.key} className="fade-in">{route(r)}</div>
        {tab && <BottomNav path={r.path} />}
      </div>
    </UiProvider>
  );
}
