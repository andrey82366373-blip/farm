import { useRoute, go, back } from './lib/router.js';
import { UiProvider, Empty, Button, Screen } from './components/ui.jsx';
import Icon from './components/Icon.jsx';
import Home from './screens/Home.jsx';
import More from './screens/More.jsx';
import Animals from './screens/Animals.jsx';
import AnimalView from './screens/AnimalView.jsx';
import AnimalForm from './screens/AnimalForm.jsx';
import Birth from './screens/Birth.jsx';
import Journal from './screens/Journal.jsx';
import Stats from './screens/Stats.jsx';
import { Sales, SaleNew, SaleView } from './screens/Sales.jsx';
import { Backup, Demo } from './screens/Backup.jsx';
import { CountSetup, CountRun, CountResult, CountView, Counts } from './screens/Count.jsx';
import { EventChooser, OutForm, VetForm, PurchaseForm } from './screens/EventForms.jsx';

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
        <button key={t.path} className={active === t.path ? 'on' : ''} onClick={() => active !== t.path && (t.path === '/' ? back('/') : go(t.path, { replace: !!active && active !== '/' }))} aria-current={active === t.path ? 'page' : undefined}>
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
    case 'animals': return <Animals />;
    case 'animal':
      if (b === 'new') return <AnimalForm />;
      if (c === 'edit') return <AnimalForm id={Number(b)} />;
      return <AnimalView id={Number(b)} />;
    case 'birth': return <Birth />;
    case 'journal': return <Journal />;
    case 'stats': return <Stats />;
    case 'sales': return <Sales />;
    case 'counts': return <Counts />;
    case 'backup': return <Backup />;
    case 'demo': return <Demo />;
    case 'count':
      if (b === 'run') return <CountRun />;
      if (b === 'result') return <CountResult />;
      if (b) return <CountView id={Number(b)} />;
      return <CountSetup />;
    case 'sale': return b === 'new' ? <SaleNew /> : <SaleView id={Number(b)} />;
    case 'event':
      if (b === 'death' || b === 'slaughter') return <OutForm type={b} />;
      if (b === 'vet') return <VetForm />;
      if (b === 'purchase') return <PurchaseForm />;
      return <EventChooser />;
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
