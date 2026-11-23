const shapes = {
  map: '<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15m6-12v15"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m16.2 7.8-2.8 5.6-5.6 2.8 2.8-5.6z"/>',
  compare:
    '<rect x="3" y="5" width="7" height="15" rx="1.5"/><rect x="14" y="3" width="7" height="15" rx="1.5"/>',
  book: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6v14"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  building:
    '<path d="M4 21h16M6 21V8h12v13M4 8l2-5h12l2 5M9 12h2m2 0h2m-4 9v-5h3v5"/>',
  store:
    '<path d="M3 10 5 4h14l2 6m-18 0c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M5 13v7h14v-7m-10 7v-5h4v5"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  polygon:
    '<path d="m5 6 13-2 2 13-11 3-4-14"/><path fill="currentColor" d="M3.5 4.5h3v3h-3zm13-2h3v3h-3zm2 13h3v3h-3zm-11 3h3v3h-3z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
  area: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
  front: '<path d="M3 8v8m18-8v8M3 12h18m-14-3-3 3 3 3m10-6 3 3-3 3"/>',
  filter:
    '<path d="M4 7h8m4 0h4M4 17h3m4 0h9"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  lab: '<path d="M9 3h6m-5 0v6l-6 10c-.5 1 .2 2 1.5 2h13c1.3 0 2-1 1.5-2L14 9V3M8 15h8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  link: '<path d="m10 14 4-4m-5 1-2 2a3 3 0 0 0 4 4l3-3m1-1 2-2a3 3 0 0 0-4-4l-3 3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  edit: '<path d="m4 16 11-11 4 4L8 20l-5 1zM13 7l4 4"/>',
  doc: '<path d="M5 3h10l4 4v14H5zm9 0v5h5M8 12h8m-8 4h6"/>',
};
export const icon = (name, size = 18) =>
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="' +
  size +
  '" height="' +
  size +
  '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  (shapes[name] || "") +
  "</svg>";
export const brandMark =
  '<svg viewBox="0 0 44 44" width="40" height="40" fill="none" aria-hidden="true"><rect width="44" height="44" rx="12" fill="#16594B"/><path d="m8 26 9-4 8 3 10-5v10l-10 5-8-3-9 3z" fill="#a9d8b3"/><path d="m17 22 8 3v10l-8-3z" fill="#eef4d1"/><path d="M30 14c0 5.4-7.7 12.9-7.7 12.9S14.6 19.4 14.6 14a7.7 7.7 0 1 1 15.4 0" fill="#fff"/><circle cx="22.3" cy="14" r="2.8" fill="#195647"/></svg>';
