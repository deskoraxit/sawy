
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

const path = {
  home: 'M4 12.5 12 5l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  briefcase: 'M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1m-8 0h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm-2 5h16',
  bell: 'M10 21a2 2 0 0 0 4 0M6 17h12l-1.5-1.5A3.5 3.5 0 0 1 15.5 13V9a3.5 3.5 0 1 0-7 0v4c0 .93-.37 1.82-1.02 2.48z',
  dollar: 'M12 2v20M16.5 6.5A4 4 0 0 0 12 4a4 4 0 1 0 0 8 4 4 0 1 1 0 8 4 4 0 0 1-4.5-2.5',
  image: 'M4 5h16v14H4zM8.5 11.5 11 14l2.5-3 4.5 5.5H6zM8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  sparkles: 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm7 10l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13z',
  tag: 'M20.59 13.41 13.41 20.59a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82zM7.5 7.5h.01',
  trend: 'M3 17l6-6 4 4 7-7M14 8h6v6',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8-3.5-.8.5.1 1-.9 1.6-1-.2-.7.7.2 1-1.6.9-1-.1-.5.8h-2l-.5-.8-1 .1-1.6-.9.2-1-.7-.7-1 .2-.9-1.6.1-1-.8-.5v-2l.8-.5-.1-1 .9-1.6 1 .2.7-.7-.2-1 1.6-.9 1 .1.5-.8h2l.5.8 1-.1 1.6.9-.2 1 .7.7 1-.2.9 1.6-.1 1 .8.5z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  save: 'M5 4h11l3 3v13H5zM8 4v6h7V4M8 14h8',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm6-2 4 4',
  logout: 'M10 17l1.5-1.5M13 12H3m10 0-3-3m3 3-3 3M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4',
  arrowLeft: 'M15 18l-6-6 6-6M9 12h12',
  arrowRight: 'M9 18l6-6-6-6M3 12h12',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 23l7.8-9.6 1-1a5.5 5.5 0 0 0 0-7.8z',
  star: 'M12 2l2.9 6 6.6 1-4.8 4.7 1.1 6.6L12 17.8 6.2 20.3l1.1-6.6L2.5 9l6.6-1z',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

export function icon(name, cls = 'nav-icon', stroke = 2) {
  const d = path[name] || path.sparkles;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
