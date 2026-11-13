// Все иконки приложения в одном месте: простые линии, хорошо видны на солнце.
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ICONS = {
  sheep: (
    <svg viewBox="0 0 48 48">
      <g fill="currentColor">
        <circle cx="15" cy="15" r="7" /><circle cx="24" cy="11" r="8" /><circle cx="33" cy="15" r="7" />
        <ellipse cx="9" cy="23" rx="6.5" ry="3.2" transform="rotate(-18 9 23)" />
        <ellipse cx="39" cy="23" rx="6.5" ry="3.2" transform="rotate(18 39 23)" />
        <path d="M15.5 17 Q24 13 32.5 17 L31 33 Q24 43 17 33 Z" />
      </g>
      <g fill="var(--icon-hole, #fff)"><circle cx="20" cy="25" r="1.9" /><circle cx="28" cy="25" r="1.9" /></g>
    </svg>
  ),
  cow: (
    <svg viewBox="0 0 48 48">
      <g fill="currentColor">
        <path d="M13 13 Q6 10 7 3 Q11 8 17 10Z" /><path d="M35 13 Q42 10 41 3 Q37 8 31 10Z" />
        <ellipse cx="7.5" cy="19" rx="6.5" ry="3.2" transform="rotate(12 7.5 19)" />
        <ellipse cx="40.5" cy="19" rx="6.5" ry="3.2" transform="rotate(-12 40.5 19)" />
        <path d="M15 10 H33 Q37 10 36.5 15 L35 29 H13 L11.5 15 Q11 10 15 10Z" />
        <rect x="11" y="27" width="26" height="16" rx="8" />
      </g>
      <g fill="var(--icon-hole, #fff)"><circle cx="18.5" cy="19" r="2" /><circle cx="29.5" cy="19" r="2" /><ellipse cx="18.5" cy="35" rx="2.3" ry="3" /><ellipse cx="29.5" cy="35" rx="2.3" ry="3" /></g>
    </svg>
  ),
  horse: (
    <svg viewBox="0 0 48 48">
      <g fill="currentColor">
        <path d="M27 9 L28.5 1.5 L32.5 9.5Z" />
        <path d="M30 6 Q38 8 41 16 Q44 25 41 36 L40 46 H21 L22 37 Q17 35 12 37.5 Q5 39 4.5 33.5 Q4 28.5 10 23 L20 13 Q23 7 30 6Z" />
        <path d="M31 5.5 Q40 6 44 14 Q47.5 23 45 36 L41.5 30 Q43 19 36 11Z" />
      </g>
      <g fill="var(--icon-hole, #fff)"><circle cx="22.5" cy="18.5" r="2" /><ellipse cx="9" cy="33" rx="1.6" ry="2.2" /></g>
    </svg>
  ),
  search: <svg viewBox="0 0 24 24"><g {...S} strokeWidth="2.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 L21 21" /></g></svg>,
  tally: <svg viewBox="0 0 24 24"><g {...S}><path d="M5 4v16M9.5 4v16M14 4v16M18.5 4v16M2.5 17.5L21.5 6.5" /></g></svg>,
  birth: <svg viewBox="0 0 24 24"><g {...S}><path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10Z" /><path d="M12 10.5v6M9 13.5h6" /></g></svg>,
  sale: <svg viewBox="0 0 24 24"><g {...S}><path d="M3 12.5V4h8.5l9.5 9.5-8.5 8.5Z" /><circle cx="8" cy="9" r="1.8" fill="currentColor" stroke="none" /></g></svg>,
  note: <svg viewBox="0 0 24 24"><g {...S}><rect x="4.5" y="3.5" width="15" height="18" rx="2.5" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" /></g></svg>,
  home: <svg viewBox="0 0 24 24"><path {...S} strokeWidth="2.2" d="M3.5 11 12 4l8.5 7v9h-6v-6h-5v6h-6Z" /></svg>,
  list: <svg viewBox="0 0 24 24"><g {...S} strokeWidth="2.2"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.3" fill="currentColor" /><circle cx="4.5" cy="12" r="1.3" fill="currentColor" /><circle cx="4.5" cy="18" r="1.3" fill="currentColor" /></g></svg>,
  book: <svg viewBox="0 0 24 24"><g {...S} strokeWidth="2.2"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /><path d="M8.5 8h7M8.5 12h5" /></g></svg>,
  more: <svg viewBox="0 0 24 24"><g fill="currentColor"><circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /></g></svg>,
  back: <svg viewBox="0 0 24 24"><path {...S} strokeWidth="2.8" d="M15 5 8 12l7 7" /></svg>,
  chevron: <svg viewBox="0 0 24 24"><path {...S} strokeWidth="2.6" d="M9 5l7 7-7 7" /></svg>,
  undo: <svg viewBox="0 0 24 24"><path {...S} d="M9 7 4 12l5 5M4.5 12H15a5 5 0 0 1 0 10h-2" /></svg>,
  reset: <svg viewBox="0 0 24 24"><path {...S} d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" /></svg>,
  plus: <svg viewBox="0 0 24 24"><path {...S} strokeWidth="2.8" d="M12 5v14M5 12h14" /></svg>,
  minus: <svg viewBox="0 0 24 24"><path {...S} strokeWidth="2.8" d="M5 12h14" /></svg>,
  check: <svg viewBox="0 0 24 24"><path {...S} strokeWidth="3" d="M4.5 12.5l5 5L19.5 7" /></svg>,
  close: <svg viewBox="0 0 24 24"><path {...S} strokeWidth="2.8" d="M6 6l12 12M18 6L6 18" /></svg>,
  edit: <svg viewBox="0 0 24 24"><g {...S}><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="M13.5 6.5l4 4" /></g></svg>,
  trash: <svg viewBox="0 0 24 24"><g {...S}><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /><path d="M10 11v6M14 11v6" /></g></svg>,
  camera: <svg viewBox="0 0 24 24"><g {...S}><path d="M3.5 8.5A2 2 0 0 1 5.5 6.5H8l1.5-2.5h5L16 6.5h2.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.5" /></g></svg>,
  cart: <svg viewBox="0 0 24 24"><g {...S}><path d="M3 4h2.5l2.2 11h10.6L20.5 7.5H7" /><circle cx="9.5" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></g></svg>,
  death: <svg viewBox="0 0 24 24"><g {...S}><path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10Z" /><path d="M12.5 8l-2 4 3 2-2 4" /></g></svg>,
  meat: <svg viewBox="0 0 24 24"><g {...S}><path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6" /><path d="M17 21V3c-2 1.5-3 4-3 7v4h3" /></g></svg>,
  vet: <svg viewBox="0 0 24 24"><g {...S}><path d="M18 3l3 3M19.5 4.5 15 9M16.5 6.5l-9.5 9.5-2 4 4-2 9.5-9.5Z" /><path d="M11 9.5l3.5 3.5M8.5 12l2 2" /></g></svg>,
  arrowUp: <svg viewBox="0 0 24 24"><g {...S}><path d="M12 20V5M6 11l6-6 6 6" /></g></svg>,
  tag: <svg viewBox="0 0 24 24"><g {...S}><path d="M6 3h12v11a6 6 0 0 1-12 0Z" /><circle cx="12" cy="7.5" r="1.8" /></g></svg>,
  calendar: <svg viewBox="0 0 24 24"><g {...S} strokeWidth="2.2"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></g></svg>,
  download: <svg viewBox="0 0 24 24"><g {...S}><path d="M12 4v11M7 10l5 5 5-5M4.5 19.5h15" /></g></svg>,
  upload: <svg viewBox="0 0 24 24"><g {...S}><path d="M12 15V4M7 9l5-5 5 5M4.5 19.5h15" /></g></svg>,
  share: <svg viewBox="0 0 24 24"><g {...S}><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></g></svg>,
  warning: <svg viewBox="0 0 24 24"><g {...S}><path d="M12 3.5 2.5 20h19Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.3" r="1.1" fill="currentColor" stroke="none" /></g></svg>,
  shield: <svg viewBox="0 0 24 24"><g {...S}><path d="M12 3l7.5 3v6c0 4.5-3.2 7.7-7.5 9-4.3-1.3-7.5-4.5-7.5-9V6Z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></g></svg>,
  flask: <svg viewBox="0 0 24 24"><g {...S}><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3" /><path d="M7.5 14h9" /></g></svg>,
  chart: <svg viewBox="0 0 24 24"><g {...S}><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></g></svg>,
  phone: <svg viewBox="0 0 24 24"><g {...S}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></g></svg>,
  offline: <svg viewBox="0 0 24 24"><g {...S} strokeWidth="2.2"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16.3a5 5 0 0 1 6 0" /><path d="M3 3l18 18" /></g></svg>,
  eye: <svg viewBox="0 0 24 24"><g {...S}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></g></svg>,
  female: <svg viewBox="0 0 24 24"><g {...S}><circle cx="12" cy="9" r="5" /><path d="M12 14v7M9 18h6" /></g></svg>,
  heart: <svg viewBox="0 0 24 24"><path {...S} d="M12 20.5s-8-4.6-8-10.4A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.7c0 5.8-8 10.4-8 10.4Z" /></svg>,
  hay: <svg viewBox="0 0 24 24"><g {...S}><rect x="3" y="7" width="18" height="12" rx="3" /><path d="M3 11h18M3 15h18M8 7v12M16 7v12" /></g></svg>,
  coins: <svg viewBox="0 0 24 24"><g {...S}><ellipse cx="9" cy="7" rx="5.5" ry="2.5" /><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" /><path d="M9.5 16.5c.9.3 2 .5 3.5.5 3 0 5.5-1.1 5.5-2.5v-4c0-1.2-1.8-2.2-4.3-2.4" /><path d="M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5" /></g></svg>,
  settings: <svg viewBox="0 0 24 24"><g {...S}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></g></svg>,
  clock: <svg viewBox="0 0 24 24"><g {...S}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g></svg>,
  male: <svg viewBox="0 0 24 24"><g {...S}><circle cx="10" cy="14" r="5" /><path d="M13.5 10.5 20 4M15 4h5v5" /></g></svg>,
};

export default function Icon({ name, size, className = '', style }) {
  const svg = ICONS[name];
  if (!svg) return null;
  return (
    <span className={`icon ${className}`} style={size ? { width: size, height: size, ...style } : style} aria-hidden="true">
      {svg}
    </span>
  );
}
