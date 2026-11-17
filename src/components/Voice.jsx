import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { interpret, VOICE_EXAMPLES } from '../lib/voice.js';
import { drugSuggestions } from '../lib/shots.js';
import { go } from '../lib/router.js';
import { Sheet, Button } from './ui.jsx';
import Icon from './Icon.jsx';
import { DEFAULT_VEHICLES } from '../screens/Fuel.jsx';

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const voiceSupported = () => !!Recognition;

const ERRORS = {
  'not-allowed': 'Нет разрешения на микрофон. Разрешите его в настройках браузера для этого сайта.',
  'service-not-allowed': 'Нет разрешения на микрофон. Разрешите его в настройках браузера для этого сайта.',
  network: 'Нет интернета. Для голоса нужен интернет: распознавание идёт через Google.',
  'no-speech': 'Ничего не услышал. Нажмите на микрофон и говорите сразу.',
  'audio-capture': 'Микрофон не найден или занят другим приложением.',
};

// Окно голосового ввода: слушает, показывает, что понял, и открывает форму.
// Ничего не сохраняет: сохраняет папа в форме кнопкой «Сохранить».
export function VoiceSheet({ onClose }) {
  const animals = useLiveQuery(() => db.animals.toArray(), []);
  const vet = useLiveQuery(() => db.events.where('type').equals('vet').toArray(), []);
  const vehicles = useLiveQuery(() => db.settings.get('vehicles').then((r) => r?.value || DEFAULT_VEHICLES), []);
  const [phase, setPhase] = useState('idle'); // idle | listening | done | error
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const rec = useRef(null);
  const online = navigator.onLine;

  const understand = (text) => {
    const r = interpret(text, { animals: animals || [], drugs: drugSuggestions(vet).map((d) => d.name), vehicles: vehicles || DEFAULT_VEHICLES });
    setResult(r);
    setPhase('done');
  };

  const listen = () => {
    if (!Recognition) return;
    setError(null); setHeard(''); setResult(null);
    const r = new Recognition();
    r.lang = 'ru-RU';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = false;
    let final = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tx = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += tx; else interim += tx;
      }
      setHeard((final + interim).trim());
    };
    r.onerror = (e) => { setError(ERRORS[e.error] || 'Не получилось распознать. Попробуйте ещё раз или напишите фразу.'); setPhase('error'); };
    r.onend = () => {
      rec.current = null;
      if (final.trim()) understand(final.trim());
      else setPhase((p) => (p === 'listening' ? 'idle' : p));
    };
    rec.current = r;
    setPhase('listening');
    try { r.start(); } catch { setPhase('error'); setError('Микрофон сейчас занят. Попробуйте ещё раз.'); }
  };
  const stop = () => rec.current?.stop();
  useEffect(() => () => rec.current?.abort?.(), []);

  const open = () => { onClose(); go(result.route); };
  const choose = (path) => { onClose(); go(`${path}${path.includes('?') ? '&' : '?'}voice=${encodeURIComponent(result.text)}`); };

  return (
    <Sheet open onClose={onClose} title="Сказать голосом">
      {!online && (
        <div className="banner"><Icon name="warning" /><div className="banner-body"><p>Нет интернета. Для голоса нужен интернет. Можно написать фразу ниже, это работает и без сети.</p></div></div>
      )}
      {Recognition ? (
        <div className="voice-mic">
          <button className={`mic-big press ${phase === 'listening' ? 'on' : ''}`} onClick={phase === 'listening' ? stop : listen} aria-label={phase === 'listening' ? 'Остановить' : 'Говорить'} disabled={!online}>
            <Icon name="mic" />
          </button>
          <div className="voice-state">
            {phase === 'listening' ? 'Слушаю… Говорите' : phase === 'done' ? 'Готово' : 'Нажмите и скажите, что случилось'}
          </div>
          {online && <p className="pill-note center">Для голоса нужен интернет.</p>}
        </div>
      ) : (
        <p className="muted">Этот браузер не умеет распознавать речь. Откройте приложение в Chrome или напишите фразу ниже.</p>
      )}

      {heard && <div className="voice-heard">«{heard}»</div>}
      {error && <div className="field-error">{error}</div>}

      {result && (
        <div className={`card voice-result ${result.kind === 'unknown' ? 'unknown' : ''}`}>
          <div className="row-title">{result.kind === 'unknown' ? 'Не понял, что записать' : `Понял: ${result.title}`}</div>
          {result.lines.length > 0 && <ul>{result.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
          {result.kind !== 'unknown' ? (
            <>
              <Button kind="primary" size="lg" block icon="check" onClick={open}>{result.kind === 'animal' ? 'Открыть карточку' : 'Открыть форму'}</Button>
              <p className="pill-note">Ничего ещё не записано. В форме проверьте и нажмите «Сохранить».</p>
            </>
          ) : (
            <>
              <p className="muted">Выберите, что открыть:</p>
              <div className="voice-pick">
                {[['Родились', '/birth'], ['Укол', '/event/vet'], ['Падёж', '/event/death'], ['Заправка', '/fuel/new'], ['Продажа', '/sale/new'], ['Другое событие', '/event']].map(([l, p]) => (
                  <Button key={p} size="sm" onClick={() => choose(p)}>{l}</Button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="voice-type">
        <label className="field-label" htmlFor="voiceText">Или напишите</label>
        <div className="picker-tag">
          <input id="voiceText" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && typed.trim() && understand(typed.trim())} placeholder="родилась двойня у 105" autoComplete="off" />
          <Button kind="dark" icon="check" disabled={!typed.trim()} onClick={() => { setHeard(''); understand(typed.trim()); }}>Понять</Button>
        </div>
      </div>
      <Button kind="ghost" onClick={() => { onClose(); go('/voice'); }}>Примеры фраз</Button>
    </Sheet>
  );
}

export function VoiceExamples() {
  return (
    <div className="list">
      {VOICE_EXAMPLES.map((g) => (
        <div key={g.group} className="card voice-ex">
          <div className="row-title">{g.group}</div>
          <ul>{g.items.map((x) => <li key={x}>«{x}»</li>)}</ul>
        </div>
      ))}
    </div>
  );
}
