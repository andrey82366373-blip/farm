import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { downloadBackup, shareBackup, canShareFiles, readBackupFile, backupStats, restoreBackup, backupDue } from '../lib/backup.js';
import { loadDemo, removeDemo } from '../lib/demo.js';
import { fmtDate, toISO, heads, daysBetween, today, plural } from '../lib/format.js';
import { go } from '../lib/router.js';
import { Screen, Button, Sheet, useUi, useAction } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

/* ---------- Резервная копия ---------- */
export function Backup() {
  const last = useLiveQuery(() => db.settings.get('lastBackupAt').then((r) => r?.value ?? null), []);
  const count = useLiveQuery(() => db.animals.count(), []);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const run = useAction();
  const { notify } = useUi();
  const share = canShareFiles();

  const lastIso = last ? toISO(new Date(last)) : null;
  const days = lastIso ? daysBetween(lastIso, today()) : null;
  const due = backupDue(count, last);

  const save = async () => {
    setBusy(true);
    await run(() => downloadBackup(), 'Файл копии сохранён в «Загрузки»');
    setBusy(false);
  };
  const send = async () => {
    setBusy(true);
    try {
      await shareBackup();
      notify('Копия отправлена');
    } catch (e) {
      if (e?.name !== 'AbortError') notify('Не получилось отправить. Сохраните файл кнопкой выше.', 'error');
    }
    setBusy(false);
  };
  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = await readBackupFile(f);
      setPending({ data, stats: backupStats(data), name: f.name });
    } catch (err) {
      notify(err.message, 'error');
    }
  };
  const restore = async () => {
    setBusy(true);
    const ok = await run(() => restoreBackup(pending.data), 'Данные восстановлены из копии');
    setBusy(false);
    if (ok) { setPending(null); go('/', { replace: true }); }
  };

  return (
    <Screen title="Резервная копия" backTo="/more">
      <div className={`card backup-state ${due ? 'due' : 'fresh'}`}>
        <Icon name={due ? 'warning' : 'shield'} />
        <div>
          <div className="row-title">
            {days === null ? 'Копии ещё не было' : days === 0 ? 'Копия сделана сегодня' : `Последняя копия ${days} ${plural(days, 'день', 'дня', 'дней')} назад`}
          </div>
          <div className="row-sub">{lastIso ? fmtDate(lastIso, { year: true }) : 'Сделайте первую копию прямо сейчас'}{count ? `. В телефоне ${heads(count)}` : ''}</div>
        </div>
      </div>

      <p>Все записи хранятся только в этом телефоне. Если телефон сломается или потеряется, данные можно вернуть только из файла копии. Делайте копию раз в неделю, приложение напомнит.</p>

      {share && <Button kind="primary" size="lg" icon="share" block disabled={busy} onClick={send}>Отправить копию</Button>}
      {share && <p className="pill-note">Лучший способ: отправьте файл себе в Телеграм, Ватсап или на почту. Тогда копия будет не только в телефоне.</p>}
      <Button kind={share ? 'plain' : 'primary'} size="lg" icon="download" block disabled={busy} onClick={save}>Сохранить файл в телефон</Button>

      <div className="divider" />

      <h2 className="h2">Восстановить из копии</h2>
      <p className="muted">На новом телефоне откройте приложение, нажмите кнопку ниже и выберите файл «ferma-kopiya-…». Данные в телефоне заменятся данными из файла.</p>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={pickFile} />
      <Button icon="upload" size="lg" block disabled={busy} onClick={() => fileRef.current.click()}>Выбрать файл копии</Button>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Восстановить из этого файла?">
        {pending && (
          <>
            <div className="card">
              <dl className="kv">
                <dt>Файл</dt><dd>{pending.name}</dd>
                <dt>Копия от</dt><dd>{pending.stats.exportedAt ? fmtDate(toISO(new Date(pending.stats.exportedAt)), { year: true }) : '—'}</dd>
                <dt>Животных</dt><dd>{pending.stats.animals}, на хозяйстве {pending.stats.active}</dd>
                <dt>Записей</dt><dd>{pending.stats.events}</dd>
              </dl>
            </div>
            <div className="banner">
              <Icon name="warning" />
              <div className="banner-body"><p>Всё, что сейчас в телефоне, будет заменено данными из файла. {count ? `Сейчас в телефоне ${heads(count)}.` : ''}</p></div>
            </div>
            <Button kind="danger" size="lg" block icon="upload" disabled={busy} onClick={restore}>Заменить и восстановить</Button>
            <Button block onClick={() => setPending(null)}>Отмена</Button>
          </>
        )}
      </Sheet>
    </Screen>
  );
}

/* ---------- Тестовые данные ---------- */
export function Demo() {
  const demo = useLiveQuery(() => db.animals.where('demo').equals(1).count(), []);
  const real = useLiveQuery(() => db.animals.filter((a) => !a.demo).count(), []);
  const [busy, setBusy] = useState(false);
  const { confirm } = useUi();
  const run = useAction();
  if (demo === undefined || real === undefined) return <Screen title="Тестовые данные" />;

  const load = async () => {
    setBusy(true);
    const ok = await run(() => loadDemo(), 'Тестовые данные загружены');
    setBusy(false);
    if (ok) go('/', { replace: true });
  };
  const remove = async () => {
    const ok = await confirm({
      icon: 'trash', danger: true, title: 'Удалить тестовые данные?',
      text: `Удалятся ${heads(demo)} из примера и все их записи. ${real ? `Ваши ${heads(real)} останутся.` : ''}`, ok: 'Удалить пример',
    });
    if (!ok) return;
    setBusy(true);
    await run(() => removeDemo(), 'Тестовые данные удалены');
    setBusy(false);
  };

  return (
    <Screen title="Тестовые данные" backTo="/more">
      <div className="card demo-card">
        <Icon name="flask" />
        <p>Пример хозяйства, чтобы всё проверить: около 85 голов овец, коров и лошадей, окоты за два года, падёж, прививки, продажи, покупки и пересчёты.</p>
      </div>
      {demo > 0 ? (
        <>
          <p>Сейчас загружено <b>{heads(demo)}</b> из примера. Перед настоящей работой удалите пример: ваши записи при этом не пострадают.</p>
          <Button kind="danger" size="lg" icon="trash" block disabled={busy} onClick={remove}>Удалить тестовые данные</Button>
        </>
      ) : real > 0 ? (
        <p className="muted">В приложении уже есть ваши животные ({heads(real)}). Пример можно загрузить только в пустое приложение, чтобы не перепутать записи.</p>
      ) : (
        <Button kind="primary" size="lg" icon="flask" block disabled={busy} onClick={load}>Загрузить тестовые данные</Button>
      )}
    </Screen>
  );
}
