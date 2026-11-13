import { db, TABLES, setSetting } from './db.js';
import { today } from './format.js';

const WEEK = 7 * 24 * 3600 * 1000;

// Напоминаем о копии, если есть данные и прошло больше недели.
export function backupDue(animalCount, lastBackupAt) {
  if (!animalCount) return false;
  if (!lastBackupAt) return true;
  return Date.now() - lastBackupAt > WEEK;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function dataUrlToBlob(url) {
  return (await fetch(url)).blob();
}

export async function buildBackup() {
  const out = { app: 'farm', version: 1, exportedAt: new Date().toISOString(), tables: {} };
  for (const t of TABLES) {
    const rows = await db[t].toArray();
    if (t === 'photos') {
      out.tables.photos = await Promise.all(rows.map(async (p) => ({ animalId: p.animalId, dataUrl: await blobToDataUrl(p.blob) })));
    } else if (t === 'settings') {
      out.tables.settings = rows.filter((r) => r.key !== 'lastBackupAt');
    } else {
      out.tables[t] = rows;
    }
  }
  return out;
}

export function backupFileName() {
  return `ferma-kopiya-${today()}.json`;
}

export async function backupFile() {
  const data = await buildBackup();
  const json = JSON.stringify(data);
  return new File([json], backupFileName(), { type: 'application/json' });
}

// Сохранить файл в «Загрузки» телефона.
export async function downloadBackup() {
  const file = await backupFile();
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  await setSetting('lastBackupAt', Date.now());
  return file;
}

export function canShareFiles() {
  try {
    const f = new File(['{}'], 'x.json', { type: 'application/json' });
    return !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}

// Отправить файл в мессенджер или на почту (себе или родным).
export async function shareBackup() {
  const file = await backupFile();
  await navigator.share({ files: [file], title: 'Копия данных фермы', text: `Копия данных фермы от ${today()}` });
  await setSetting('lastBackupAt', Date.now());
}

export async function readBackupFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Это не файл копии. Выберите файл, который начинается на «ferma-kopiya».');
  }
  if (data?.app !== 'farm' || !data.tables?.animals) {
    throw new Error('В файле нет данных фермы. Выберите другой файл.');
  }
  return data;
}

export function backupStats(data) {
  const t = data.tables;
  return {
    animals: t.animals?.length ?? 0,
    active: t.animals?.filter((a) => a.status === 'active').length ?? 0,
    events: t.events?.length ?? 0,
    exportedAt: data.exportedAt,
  };
}

// Полностью заменить данные на телефоне данными из файла.
export async function restoreBackup(data) {
  const photos = await Promise.all((data.tables.photos || []).map(async (p) => ({ animalId: p.animalId, blob: await dataUrlToBlob(p.dataUrl) })));
  await db.transaction('rw', TABLES.map((t) => db[t]), async () => {
    for (const t of TABLES) {
      if (t === 'settings') continue;
      await db[t].clear();
    }
    for (const t of TABLES) {
      if (t === 'photos') await db.photos.bulkAdd(photos);
      else if (t === 'settings') await db.settings.bulkPut(data.tables.settings || []);
      else if (data.tables[t]?.length) await db[t].bulkAdd(data.tables[t]);
    }
    await db.settings.put({ key: 'lastBackupAt', value: Date.now() });
  });
}
