import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/onest/cyrillic-400.css';
import '@fontsource/onest/cyrillic-500.css';
import '@fontsource/onest/cyrillic-600.css';
import '@fontsource/onest/cyrillic-700.css';
import '@fontsource/onest/cyrillic-800.css';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-500.css';
import '@fontsource/onest/latin-600.css';
import '@fontsource/onest/latin-700.css';
import '@fontsource/onest/latin-800.css';
import './styles.css';
import App from './App.jsx';
import { askPersistentStorage, migrate } from './lib/db.js';
import { applySeason, seasonByDate } from './lib/season.js';

applySeason(seasonByDate());

// Приложение сохраняется в телефоне и потом открывается без интернета.
if (!import.meta.env.VITE_NO_SW) registerSW({ immediate: true });
askPersistentStorage();

// Сначала дописываем новые поля в данные старой версии, потом рисуем экран.
migrate().catch((e) => console.error('migrate', e)).finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
