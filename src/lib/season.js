// Время года по дате: декабрь–февраль зима, март–май весна и так далее.
export const SEASONS = [
  { key: 'winter', label: 'Зима' },
  { key: 'spring', label: 'Весна' },
  { key: 'summer', label: 'Лето' },
  { key: 'autumn', label: 'Осень' },
];

export function seasonByDate(d = new Date()) {
  const m = d.getMonth();
  if (m === 11 || m < 2) return 'winter';
  if (m < 5) return 'spring';
  if (m < 8) return 'summer';
  return 'autumn';
}

export function applySeason(key) {
  document.documentElement.dataset.season = key;
  const sky = { winter: '#C5D6E8', spring: '#BDE6F1', summer: '#9FD4F5', autumn: '#F2D6A8' }[key];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sky);
}
