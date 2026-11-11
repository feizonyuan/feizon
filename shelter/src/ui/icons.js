// 线条图标，24×24，颜色跟随 currentColor。
const svg = (body) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  farm: svg('<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/><path d="M5 21h14"/>'),
  purifier: svg('<path d="M12 3c3.5 4.2 6 7.300 6 10.500a6 6 0 0 1-12 0C6 10.300 8.500 7.200 12 3z"/><path d="M9.500 14a2.500 2.500 0 0 0 2.500 2.500"/>'),
  solar: svg('<path d="M4 20l2.500-9h11L20 20z"/><path d="M10 11l-1 9M14 11l1 9M5.200 15.500h13.600"/><circle cx="12" cy="5" r="1.800"/><path d="M12 1.500v.700M8.700 5H8M16 5h-.700M9.600 2.600l.500.500M14.400 2.600l-.500.500"/>'),
  tradepost: svg('<path d="M4 9h13l-3-3"/><path d="M20 15H7l3 3"/>'),
  wall: svg('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.700h18M3 14.300h18M9 5v4.700M15 5v4.700M12 9.700v4.600M9 14.300V19M15 14.300V19"/>'),
  truck: svg('<path d="M2 16V8h11v8"/><path d="M13 11h4.500l3.500 3v2h-8"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  people: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6"/><path d="M16 5.200a3 3 0 0 1 0 5.600M18 14.500c1.800.900 3 2.800 3 5.500"/>'),
  hurt: svg('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'),
  snow: svg('<path d="M12 2v20M3.300 7l17.400 10M20.700 7L3.300 17"/><path d="M9.500 3.500L12 6l2.500-2.500M9.500 20.500L12 18l2.500 2.500"/>'),
  near: svg('<path d="M4 20V10l5-4 5 4v10"/><path d="M14 20v-7h6v7"/><path d="M2 20h20"/>'),
  deep: svg('<path d="M3 20l5-11 3.500 6 2.500-4 7 9z"/><path d="M15 4v4M13 6h4"/>'),
  rest: svg('<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 15h18M6 10V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>'),
  build: svg('<path d="M14 6l4 4"/><path d="M12.500 7.500l4 4L8 20H4v-4z"/><path d="M15 4.500l1.500-1.500 4.500 4.500L19.500 9"/>'),
  ledger: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};
