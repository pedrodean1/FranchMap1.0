import {
  profile,
  branches,
  demos,
  evaluate,
  statuses,
  fields,
  formVal,
  fmt,
  inGeometry,
  nearest,
  safeUrl,
} from "./model.mjs";
import {
  createMap,
  candidateMarker,
  branchMarker,
  territoryStyle,
  zoneStyle,
  geography,
  esc,
} from "./maps.mjs";
import { icon, brandMark } from "./icons.mjs";
import {
  activeRecords,
  blankInventory,
  county,
  toCandidate,
} from "./inventory.mjs";
import { inquiryContent, shortlist } from "./inquiries.mjs";
import { editor } from "./editor.mjs";
const $ = (s) => document.querySelector(s),
  all = (s) => [...document.querySelectorAll(s)];
document
  .querySelectorAll("[data-i]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.i)));
$("#logo").innerHTML = brandMark;
const mainMap = createMap("map"),
  map = mainMap.m,
  markers = L.layerGroup().addTo(map),
  stores = L.layerGroup().addTo(map),
  territories = L.layerGroup().addTo(map),
  filterLayer = L.layerGroup().addTo(map);
const storageKey = "franchmap.candidates.v1";
let mine = [],
  storeIssue = false;
try {
  mine = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (!Array.isArray(mine)) throw Error();
  mine = mine.filter(
    (c) =>
      c && c.id && c.values && Number.isFinite(c.lat) && Number.isFinite(c.lng),
  );
} catch {
  mine = [];
  storeIssue = true;
}
let inventory = blankInventory(),
  inventoryError = false,
  loadedInventory = false;
const replyKey = (id) => "franchmap.brandReply.v1." + id;
function inventoryCandidates() {
  return activeRecords(inventory).map((row, i) => {
    let reply;
    try {
      reply = JSON.parse(
        localStorage.getItem(replyKey(row.source + ":" + row.sourceId)) ||
          "null",
      );
    } catch {}
    return toCandidate(row, i + 1, reply);
  });
}
const state = {
  mode: "inventory",
  geo: null,
  zone: null,
  focus: null,
  selection: new Set(),
  branches: true,
  territories: true,
  detail: false,
  draw: null,
  dialog: "",
  cleanup: null,
};
const catalog = () => [...inventoryCandidates(), ...mine, ...demos],
  item = (id) => catalog().find((c) => c.id === id);
const visible = () =>
  (state.mode === "mine"
    ? mine
    : state.mode === "inventory"
      ? inventoryCandidates()
      : demos
  )
    .filter(
      (c) =>
        !state.zone ||
        (c.imported &&
          state.zone.properties.type === "county" &&
          state.zone.properties.name === "Miami-Dade") ||
        inGeometry([c.lng, c.lat], state.zone.geometry),
    )
    .map((c) => ({ c, e: evaluate(c) }))
    .sort(
      (a, b) =>
        ({ good: 0, pending: 1, bad: 2 })[a.e.state] -
          { good: 0, pending: 1, bad: 2 }[b.e.state] ||
        b.e.prefs - a.e.prefs ||
        a.c.number - b.c.number,
    );
const labelState = (s) =>
  '<span class="pill ' +
  s +
  '">' +
  icon({ good: "check", pending: "clock", bad: "alert" }[s], 13) +
  statuses[s].short +
  "</span>";
const btn = (action, label, ic, cl = "secondary", id = "") =>
  '<button type="button" class="' +
  cl +
  '" data-do="' +
  action +
  '" ' +
  (id ? 'data-id="' + esc(id) + '"' : "") +
  ">" +
  icon(ic, 16) +
  esc(label) +
  "</button>";
const alink = (url, label) =>
  safeUrl(url)
    ? '<a href="' +
      esc(url) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(label) +
      "</a>"
    : esc(label);
const ddate = (d) => {
  if (!d) return "Sin fecha";
  const t = new Date(d + "T12:00:00");
  return Number.isNaN(+t)
    ? esc(d)
    : new Intl.DateTimeFormat("es-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(t);
};
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.hidden = false;
  t.textContent = msg;
  $("#live").textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4500);
}
function close() {
  const el = $("#modal");
  if (el.open) el.close();
}
function cleanup() {
  if (state.cleanup) {
    state.cleanup();
    state.cleanup = null;
  }
  state.dialog = "";
  all(".top nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.do === "explore"),
  );
}
$("#modal").addEventListener("close", cleanup);
$("#modal").addEventListener("click", (e) => {
  if (e.target !== $("#modal")) return;
  const r = $("#modal").getBoundingClientRect();
  if (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  )
    close();
});
function dialog(title, sub, body, view) {
  if (state.cleanup) {
    state.cleanup();
    state.cleanup = null;
  }
  state.dialog = view;
  const el = $("#modal");
  $("#dialog-content").innerHTML =
    '<div class="dialog-head"><div><h2 id="dialog-title">' +
    esc(title) +
    "</h2>" +
    (sub ? "<p>" + esc(sub) + "</p>" : "") +
    "</div>" +
    btn("close", "", "close", "xbtn").replace(
      "data-do",
      'aria-label="Cerrar" data-do',
    ) +
    '</div><div class="dialog-body">' +
    body +
    "</div>";
  el.setAttribute("aria-labelledby", "dialog-title");
  if (!el.open) el.showModal();
  el.scrollTop = 0;
  all(".top nav button").forEach((b) =>
    b.classList.toggle(
      "active",
      b.dataset.do ===
        (view === "compare"
          ? "compare"
          : view === "sources" || view === "rules"
            ? "sources"
            : "explore"),
    ),
  );
}
function setCount() {
  const n = state.selection.size;
  $("#nav-count").textContent = n;
  $("#nav-count").hidden = !n;
}
function selected(id) {
  return state.selection.has(id) ? "checked" : "";
}
function drawCards() {
  const rows = visible();
  $("#result-count").textContent = rows.length;
  all(".segments button").forEach((b) => {
    const on = b.dataset.do === state.mode;
    b.classList.toggle("chosen", on);
    b.setAttribute("aria-pressed", on);
  });
  $("#mode-note").innerHTML =
    state.mode === "inventory"
      ? "<span>Miami-Dade County · " +
        (inventory.imports.mdc
          ? "consultado el " + ddate(inventory.imports.mdc)
          : "Catálogo de venta") +
        '</span><button class="text-action" data-do="review">Consultas</button>'
      : state.mode === "demo"
        ? icon("lab", 15) + "Datos simulados · sin oferta comercial"
        : icon("list", 15) + "Guardados en este navegador";
  $("#cards").innerHTML = rows.length
    ? rows
        .map(
          ({ c, e }) =>
            '<article class="card ' +
            (state.focus === c.id ? "selected" : "") +
            '"><button class="card-open" data-do="detail" data-id="' +
            esc(c.id) +
            '"><span class="card-heading"><span class="id-tag">' +
            String(c.number).padStart(2, "0") +
            "</span><span><strong>" +
            esc(c.name) +
            "</strong><small>" +
            esc(c.imported ? "Folio " + c.sourceId : c.address) +
            " · " +
            esc(c.city || c.zip || profile.market) +
            "</small></span>" +
            icon("right", 15) +
            '</span><span class="card-metrics"><span>' +
            icon("area", 14) +
            (c.values.area != null
              ? fmt(c.values.area) + " ft² útiles"
              : c.values.totalArea != null
                ? fmt(c.values.totalArea) + " ft² totales"
                : "Terreno sin dato") +
            "</span><span>" +
            icon("front", 14) +
            (c.imported
              ? "En catálogo de venta"
              : c.values.front != null
                ? fmt(c.values.front) + " ft de frente"
                : "Frente sin dato") +
            "</span></span>" +
            (c.imported && e.fails.some((r) => r.key === "area")
              ? '<span class="card-decision">La parcela no alcanza los 45,000 ft² útiles.</span>'
              : "") +
            '</button><div class="card-bottom">' +
            labelState(e.state) +
            '<label class="pick"><input type="checkbox" data-pick="' +
            esc(c.id) +
            '" ' +
            selected(c.id) +
            ">Comparar</label></div></article>",
        )
        .join("")
    : '<div class="empty">' +
      (state.mode === "inventory" && (!loadedInventory || inventoryError)
        ? inventoryError
          ? "No se pudo cargar el inventario. " +
            btn("reload-inventory", "Reintentar", "list")
          : "Cargando el catálogo de venta…"
        : state.zone
          ? "No hay candidatos dentro de esta zona. " +
            btn("reset-zone", "Ver todo el mercado", "map")
          : state.mode === "inventory"
            ? "El catálogo consultado no incluye terrenos en la muestra."
            : "Aún no has agregado locales. Guarda una dirección para evaluar el terreno. " +
              btn("add", "Agregar local", "plus")) +
      "</div>";
  setCount();
}
function drawMap() {
  markers.clearLayers();
  stores.clearLayers();
  territories.clearLayers();
  if (state.branches) branches.forEach((b) => branchMarker(b).addTo(stores));
  for (const { c, e } of visible()) {
    candidateMarker(c, e.state)
      .addTo(markers)
      .bindTooltip(esc(c.name), { direction: "top", offset: [0, -30] })
      .on("click", () => showDetail(c.id));
    if (state.territories && c.territory?.geometry)
      L.geoJSON(c.territory.geometry, { style: territoryStyle })
        .bindPopup(
          c.demo
            ? "Territorio simulado · ejemplo"
            : "Territorio aportado para " + esc(c.name),
        )
        .addTo(territories);
  }
}
function render() {
  drawCards();
  drawMap();
}
function fit() {
  if (
    state.zone &&
    !(state.zone.properties.type === "county" && visible().length)
  ) {
    map.fitBounds(L.geoJSON(state.zone.geometry).getBounds(), {
      padding: [25, 25],
      maxZoom: 14,
    });
    return;
  }
  const list = visible();
  if (list.length) {
    const b = L.latLngBounds(list.map(({ c }) => [c.lat, c.lng]));
    if (state.mode === "demo") b.extend([25.81, -80.139]);
    map.fitBounds(b, { padding: [40, 46], maxZoom: 12 });
  } else map.setView([25.798, -80.27], 10.75);
}
function setZone(zone, fitMap = true) {
  state.zone = zone;
  filterLayer.clearLayers();
  if (zone) L.geoJSON(zone.geometry, { style: zoneStyle }).addTo(filterLayer);
  $("#zone-query").value = zone?.properties.name || "";
  $("#clear-zone").hidden = !zone;
  render();
  if (fitMap) fit();
}
function cancelDraw() {
  state.draw = null;
  $("#map-instruction").hidden = true;
  $("#draw").classList.remove("on");
  $("#map").classList.remove("draw-mode");
  map.doubleClickZoom.enable();
  filterLayer.clearLayers();
  if (state.zone)
    L.geoJSON(state.zone.geometry, { style: zoneStyle }).addTo(filterLayer);
}
function drawMode() {
  if (state.draw) {
    cancelDraw();
    return;
  }
  state.draw = [];
  $("#layer-panel").hidden = true;
  $("#draw").classList.add("on");
  $("#map").classList.add("draw-mode");
  map.doubleClickZoom.disable();
  drawGuide();
}
function drawGuide() {
  const n = state.draw.length,
    msg = $("#map-instruction");
  msg.hidden = false;
  msg.innerHTML =
    "<b>Dibuja el área</b> · " +
    (n ? n + " puntos" : "Toca al menos tres puntos del mapa") +
    " " +
    (n ? btn("undo", "Deshacer", "minus", "") : "") +
    btn("finish", "Aplicar", "check", "") +
    btn("cancel-draw", "Cancelar", "close", "");
  msg.querySelector('[data-do="finish"]').disabled = n < 3;
  filterLayer.clearLayers();
  if (n) {
    (n >= 3 ? L.polygon : L.polyline)(state.draw, zoneStyle).addTo(filterLayer);
    state.draw.forEach((p) =>
      L.circleMarker(p, {
        radius: 4,
        color: "#21664c",
        fillOpacity: 1,
        interactive: false,
      }).addTo(filterLayer),
    );
  }
}
map.on("click", (e) => {
  if (state.draw) {
    state.draw.push(e.latlng);
    drawGuide();
  }
});
function finishDraw() {
  if (!state.draw || state.draw.length < 3) return;
  const points = state.draw.map((p) => [p.lng, p.lat]);
  points.push(points[0]);
  const area = Math.abs(
    points
      .slice(1)
      .reduce(
        (sum, p, i) => sum + points[i][0] * p[1] - p[0] * points[i][1],
        0,
      ),
  );
  if (area < 1e-10) {
    toast("Marca al menos tres puntos que formen un área.");
    return;
  }
  cancelDraw();
  setZone({
    properties: { name: "Zona dibujada" },
    geometry: { type: "Polygon", coordinates: [points] },
  });
  toast("Zona aplicada a los candidatos.");
}
const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
geography
  .then((g) => {
    state.geo = g;
    $("#zones").innerHTML =
      '<option value="Culver’s en Miami-Dade"></option>' +
      [...g.counties, ...g.zones]
        .map((f) => '<option value="' + esc(f.properties.name) + '"></option>')
        .join("");
  })
  .catch(() =>
    toast(
      "No se pudo cargar la cartografía local. Recarga para buscar por zona.",
    ),
  );
$("#filters").onsubmit = (e) => {
  e.preventDefault();
  const q = norm($("#zone-query").value);
  if (!q) {
    setZone(null);
    return;
  }
  if (!state.geo) {
    toast("Cargando los límites geográficos.");
    return;
  }
  const marketQuery = /^culver['’]?s\s+(?:en\s+)?miami[- ]dade$/i.test(q);
  if (marketQuery) state.mode = "inventory";
  const clean = (marketQuery ? "miami-dade" : q).replace(
    /,?\s+(fl|florida)$/,
    "",
  );
  const match = [...state.geo.counties, ...state.geo.zones].find(
    (f) => norm(f.properties.name) === clean,
  );
  if (match) {
    cancelDraw();
    setZone(match);
    toast(
      "Zona aplicada: " +
        match.properties.name +
        (match.properties.type === "zip" ? " (ZCTA aproximada)" : ""),
    );
  } else
    toast("Elige una ciudad o un ZIP de Miami-Dade o Broward de la lista.");
};
function dataSource(c, key) {
  const s = c.provenance?.[key] || {
    type: c.demo ? "Ejemplo simulado" : c.sourceType || "Usuario",
    url: c.sourceUrl,
    date: c.date,
  };
  return alink(s.url, s.type) + (s.date ? " · " + ddate(s.date) : "");
}
function sourcesFor(c, r) {
  const arr = ["<span>" + alink(r.ruleSource, "Regla de la marca") + "</span>"];
  if (r.inputs?.length) {
    for (const v of new Set(
      r.inputs.filter((k) => c.values[k] != null).map((k) => dataSource(c, k)),
    ))
      arr.push("<small>" + v + "</small>");
  }
  if (r.evidence)
    arr.push(
      "<small>" +
        alink(
          r.evidence.source,
          c.demo ? "Plano simulado" : "Documento aportado",
        ) +
        " · " +
        ddate(r.evidence.date) +
        "</small>",
    );
  if (r.branch)
    arr.push(
      "<small>" + alink(r.branch.source, "Sucursal determinante") + "</small>",
    );
  if (r.routeSource)
    arr.push("<small>" + alink(r.routeSource, "Ruta documentada") + "</small>");
  return arr.join("");
}
function verdict(r) {
  return r.verdict === null
    ? '<span class="pill pending">Pendiente</span>'
    : r.verdict
      ? '<span class="pill good">Cumple</span>'
      : '<span class="pill ' +
        (r.kind === "Preferido" ? "pending" : "bad") +
        '">' +
        (r.kind === "Preferido" ? "Sin preferencia" : "Incumple") +
        "</span>";
}
const money = (c) =>
  c.price != null
    ? new Intl.NumberFormat("es-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(c.price) +
      " " +
      (c.priceUnit || "")
    : "Sin precio documentado";
function showDetail(id) {
  const c = item(id);
  if (!c) return;
  const e = evaluate(c),
    b = nearest(c),
    mandatory = e.rows.filter((r) => r.kind === "Obligatorio"),
    preferences = e.rows.filter((r) => r.kind === "Preferido");
  state.focus = id;
  drawCards();
  map.panTo([c.lat, c.lng]);
  const subtitle = [c.address, c.city, c.zip].filter(Boolean).join(" · ");
  const table = (rows) =>
    '<div class="table-scroll"><table><thead><tr>' +
    [
      "Criterio",
      "Qué exige la marca",
      "Qué ofrece el local",
      "Resultado",
      "Fuente",
    ]
      .map((h) => "<th>" + h + "</th>")
      .join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (r) =>
          "<tr><td><strong>" +
          esc(r.name) +
          "</strong><small>" +
          r.kind +
          "</small></td><td>" +
          esc(r.expected) +
          "</td><td>" +
          esc(r.actual) +
          "</td><td>" +
          verdict(r) +
          '</td><td class="result-evidence">' +
          sourcesFor(c, r) +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></div>";
  let body =
    '<div class="modal-meta">' +
    labelState(e.state) +
    (c.demo ? '<span class="pill pending">Datos de prueba</span>' : "") +
    '</div><div class="notice"><b>' +
    esc(
      e.state === "bad"
        ? "El local incumple " +
            e.fails.map((r) => r.name.toLowerCase()).join(", ") +
            "."
        : e.state === "good"
          ? "El terreno cumple los requisitos obligatorios documentados."
          : "Falta confirmar " +
            e.missing.map((r) => r.name.toLowerCase()).join(", ") +
            ".",
    ) +
    "</b><p>" +
    esc(e.next) +
    '</p></div><div class="fact-strip"><span>' +
    esc(c.operation || "Sin operación") +
    " · " +
    esc(money(c)) +
    "</span><span>" +
    esc(c.availability || "Disponibilidad desconocida") +
    " · " +
    (c.listingDate ? ddate(c.listingDate) : "Sin fecha de anuncio") +
    "</span></div>";
  if (c.listingUrl)
    body +=
      "<p>" +
      alink(
        c.listingUrl,
        c.imported
          ? "Ver página del catálogo de venta"
          : "Ver anuncio aportado",
      ) +
      "</p>";
  if (c.imported) {
    body +=
      '<div class="parcel-facts"><div><small>Folio del condado</small><strong>' +
      esc(c.sourceId) +
      "</strong></div><div><small>Terreno total</small><strong>" +
      esc(formVal("totalArea", c.values.totalArea)) +
      "</strong></div><div><small>Terreno útil</small><strong>" +
      esc(formVal("area", c.values.area)) +
      "</strong></div><div><small>Edificio existente</small><strong>" +
      esc(formVal("buildingArea", c.values.buildingArea)) +
      '</strong></div></div><p class="minor">Catálogo consultado el ' +
      ddate(c.date) +
      ". " +
      alink(c.sourceUrl, "Registro GIS") +
      " · " +
      alink(c.propertyCard, "Ficha catastral") +
      " · " +
      alink(county.auctions, "Licitaciones abiertas") +
      ". La ubicación del mapa es aproximada. Zonificación registrada: " +
      esc(c.zoning || "sin dato") +
      ". El permiso de drive-thru requiere documentación específica.</p>";
  }
  body +=
    '<p class="minor">' +
    esc(profile.brand + " · " + profile.market + " · " + profile.format) +
    ". Reglas consultadas el " +
    ddate(profile.checked) +
    '.</p><div class="dialog-actions">' +
    btn(
      "toggle-compare",
      state.selection.has(id)
        ? "Quitar de la comparación"
        : "Agregar a comparación",
      "compare",
      "secondary",
      id,
    ) +
    (c.demo || c.imported
      ? ""
      : btn("edit", "Editar datos", "edit", "secondary", id)) +
    btn("locate", "Ver ubicación", "pin", "secondary", id) +
    "</div><h3>Requisitos obligatorios · " +
    e.passed +
    " de " +
    e.required +
    "</h3>" +
    table(mandatory) +
    "<h3>Preferencias · " +
    e.prefs +
    " cumplidas</h3>" +
    table(preferences);
  body +=
    '<h3>Territorio y sucursales</h3><p class="minor">Sucursal más cercana entre las ' +
    branches.length +
    " referencias cargadas: " +
    alink(b.source, b.name) +
    " · " +
    fmt(b.km) +
    ' km en línea recta (cálculo geográfico). Cobertura parcial. La distancia informativa por sí sola no acredita exclusividad.</p><div class="dialog-actions">' +
    btn("territory-map", "Ver referencias en el mapa", "map", "secondary", id) +
    '</div><p class="minor">La aprobación final corresponde a Culver’s.</p>';
  if (c.imported) {
    if (c.brandReply)
      body +=
        "<h3>Respuesta registrada</h3><p>" +
        esc(c.brandReply.sender) +
        " · " +
        ddate(c.brandReply.date) +
        " · " +
        alink(c.brandReply.source, "Ver respuesta") +
        "</p><p>" +
        esc(c.brandReply.text) +
        "</p>";
    body += btn(
      "brand-reply",
      "Registrar respuesta de Culver’s",
      "doc",
      "secondary",
      c.id,
    );
  }
  dialog(c.name, subtitle, body, "detail");
}
function showReview() {
  const list = inventoryCandidates();
  const leads = shortlist(list);
  const screened = list.filter((c) => evaluate(c).state === "bad");
  let body =
    '<p class="notice">' +
    (list.length
      ? list.length +
        " terrenos revisados · " +
        screened.length +
        " descartados · " +
        leads.length +
        " para consulta."
      : "No hay terrenos cargados para revisar.") +
    "</p>";
  if (!leads.length) {
    if (
      list.length &&
      screened.length === list.length &&
      list.every((c) => c.values.totalArea < 45000)
    )
      body +=
        "<p>El mayor tiene " +
        fmt(Math.max(...list.map((c) => c.values.totalArea))) +
        " ft² totales. Culver’s exige 45,000 ft² útiles. Ninguno justifica una visita para este formato.</p>";
    body += inquiryContent(null);
  }
  for (const { c, e } of leads) {
    body +=
      "<h3>" +
      esc(c.name) +
      "</h3><p>Folio " +
      esc(c.sourceId) +
      " · " +
      esc(c.availability) +
      " · consultado el " +
      ddate(c.date) +
      ". " +
      e.passed +
      " de " +
      e.required +
      " obligatorios acreditados. " +
      esc(e.next) +
      "</p>" +
      btn("detail", "Ver ficha y evidencia", "doc", "secondary", c.id) +
      inquiryContent(c);
  }
  dialog(
    "Consultas a Culver’s",
    "Miami-Dade · Restaurante independiente con drive-thru",
    body,
    "review",
  );
}
function recordBrandReply(c) {
  if (!c?.imported) return;
  const old = c.brandReply || {};
  const field = (key, type, label) =>
    "<label><span>" +
    label +
    '</span><input required type="' +
    type +
    '" name="' +
    key +
    '" value="' +
    esc(old[key] || "") +
    '"></label>';
  const body =
    '<p>Registra la respuesta escrita sobre este folio. Se conserva en este navegador.</p><form id="brand-response" class="form-grid">' +
    field("sender", "text", "Remitente de Culver’s") +
    field("date", "date", "Fecha de respuesta") +
    field("source", "url", "Enlace al correo o documento") +
    '<label><span>Decisión sobre este terreno</span><select name="result"><option value="inconclusive">Pendiente de confirmación</option><option value="available">La marca confirmó territorio disponible</option><option value="unavailable">La marca confirmó territorio no disponible</option></select></label><label class="span2"><span>Texto de la respuesta que identifica la parcela</span><textarea required name="text">' +
    esc(old.text || "") +
    '</textarea></label><button class="primary" type="submit">Guardar respuesta</button></form>';
  dialog(
    "Registrar respuesta de la marca",
    c.address + " · " + c.sourceId,
    body,
    "reply",
  );
  const f = $("#brand-response");
  f.elements.result.value = old.result || "inconclusive";
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const reply = { siteId: c.id };
    for (const k of ["sender", "date", "source", "result", "text"])
      reply[k] = f.elements[k].value.trim();
    if (!safeUrl(reply.source) || !reply.sender || !reply.text) {
      toast("Completa la respuesta y su enlace.");
      return;
    }
    try {
      localStorage.setItem(replyKey(c.id), JSON.stringify(reply));
    } catch {
      toast("No se pudo guardar la respuesta.");
      return;
    }
    showDetail(c.id);
  };
}
function comparison() {
  const chosen = catalog().filter((c) => state.selection.has(c.id)),
    selection =
      '<div class="compare-pick">' +
      catalog()
        .filter(
          (c) =>
            state.selection.has(c.id) ||
            (state.mode === "inventory"
              ? c.imported
              : state.mode === "demo"
                ? c.demo
                : !c.imported && !c.demo),
        )
        .map(
          (c) =>
            '<label><input type="checkbox" data-pick="' +
            esc(c.id) +
            '" ' +
            selected(c.id) +
            "> " +
            esc(c.name) +
            (c.demo ? " · ejemplo" : "") +
            "</label>",
        )
        .join("") +
      "</div>";
  let body = selection;
  if (chosen.length >= 2) {
    const es = chosen.map((c) => evaluate(c));
    const rows = [
      ["Estado", es.map((e) => labelState(e.state))],
      [
        "Datos",
        chosen.map((c) =>
          c.demo
            ? "Ejemplo simulado"
            : c.imported
              ? county.name
              : "Local registrado",
        ),
      ],
      [
        "Disponibilidad",
        chosen.map(
          (c) =>
            esc(c.availability || "Sin confirmar") +
            "<small>" +
            (c.listingDate ? ddate(c.listingDate) : "Sin fecha de anuncio") +
            "</small>",
        ),
      ],
      [
        "Fuente del anuncio",
        chosen.map((c) =>
          c.listingUrl
            ? alink(c.listingUrl, c.sourceId || "Ver anuncio")
            : "Sin enlace",
        ),
      ],
      [
        "Fecha de consulta",
        chosen.map((c) => (c.imported ? ddate(c.date) : "Sin registrar")),
      ],
      [
        "Terreno total",
        chosen.map((c) => esc(formVal("totalArea", c.values.totalArea))),
      ],
      [
        "Terreno útil documentado",
        chosen.map((c) => esc(formVal("area", c.values.area))),
      ],
      [
        "Edificio existente",
        chosen.map((c) => esc(formVal("buildingArea", c.values.buildingArea))),
      ],
      ["Precio", chosen.map((c) => esc(money(c)))],
      ["Preferencias cumplidas", es.map((e) => e.prefs)],
      ...es[0].rows.map((r, i) => [
        r.name,
        es.map(
          (e) =>
            verdict(e.rows[i]) + "<small>" + esc(e.rows[i].actual) + "</small>",
        ),
      ]),
      ["Próximo paso", es.map((e) => esc(e.next))],
    ];
    body +=
      '<div class="table-scroll"><table><thead><tr><th>Criterio</th>' +
      chosen.map((c) => "<th>" + esc(c.name) + "</th>").join("") +
      "</tr></thead><tbody>" +
      rows
        .map(
          ([k, values]) =>
            "<tr><th>" +
            esc(k) +
            "</th>" +
            values.map((v) => "<td>" + v + "</td>").join("") +
            "</tr>",
        )
        .join("") +
      '</tbody></table></div><div class="dialog-actions">' +
      btn("export", "Exportar comparación CSV", "download") +
      "</div>";
  } else
    body +=
      '<p class="notice">Selecciona al menos dos locales para ver sus diferencias.</p>';
  dialog(
    "Comparar locales",
    profile.brand + " · " + profile.format,
    body,
    "compare",
  );
}
function exportCsv() {
  const cs = catalog().filter((c) => state.selection.has(c.id));
  const rows = [
    [
      "Nombre",
      "Latitud",
      "Longitud",
      "Datos",
      "Franquicia",
      "Formato",
      "Estado",
      "Fuente anuncio",
      "Fecha anuncio",
      "Disponibilidad",
      "Precio USD",
      "Unidad precio",
      "Folio",
      "Consulta",
      "Terreno total ft²",
      "Terreno útil ft²",
      "Edificio ft²",
      ...evaluate(cs[0]).rows.map((r) => r.name),
    ],
  ];
  cs.forEach((c) => {
    const e = evaluate(c);
    rows.push([
      c.name,
      c.lat,
      c.lng,
      c.demo ? "Ejemplo" : c.imported ? county.name : "Usuario",
      profile.brand,
      profile.format,
      statuses[e.state].label,
      c.listingUrl || "",
      c.listingDate || "",
      c.availability || "",
      c.price ?? "",
      c.priceUnit || "",
      c.sourceId || "",
      c.imported ? c.date : "",
      c.values.totalArea ?? "",
      c.values.area ?? "",
      c.values.buildingArea ?? "",
      ...e.rows.map(
        (r) =>
          r.actual +
          " · " +
          (r.verdict === null
            ? "Pendiente"
            : r.verdict
              ? "Cumple"
              : "Incumple"),
      ),
    ]);
  });
  const csv = rows
    .map((r) =>
      r
        .map(
          (v) =>
            '"' +
            String(
              typeof v === "string" && /^[=+@\-]/.test(v) ? "'" + v : v,
            ).replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "franchmap-comparacion.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function sources(rules = false) {
  const sr = (title, txt, url, link) =>
    '<div class="source-row"><strong>' +
    esc(title) +
    "</strong><p>" +
    esc(txt) +
    "</p>" +
    alink(url, link) +
    "</div>";
  let body =
    '<p class="notice">Culver’s publica mínimos y preferencias para restaurantes independientes. Su mercado Miami–Fort Lauderdale (DMA 528) figura abierto a nuevos franquiciados. El piloto cubre Miami-Dade y Broward.</p><h3>Criterios y territorio</h3><div class="source-list">' +
    sr(
      "Terreno, acceso y estacionamiento",
      "Mínimos de 45.000 ft² útiles, 150 ft de frente y 15.000 vehículos diarios. La zonificación debe admitir drive-thru. Una plaza por cada dos asientos. Los niveles preferidos se evalúan aparte.",
      profile.realEstate,
      "Culver’s · Real Estate",
    ) +
    sr(
      "Mercado aplicable",
      "Formato independiente con drive-thru. Criterios nacionales aplicados al mercado publicado.",
      profile.markets,
      "Culver’s · Available Markets",
    ) +
    sr(
      "Protección territorial",
      "El documento de divulgación de 2026 (Item 12) contempla límites específicos. Solicita el plano contractual aplicable al sitio. La lista de sucursales es parcial.",
      profile.territory,
      "Culver’s · Documento de divulgación 2026",
    ) +
    "</div>";
  body +=
    '<h3>Otros puntos que revisar con la marca</h3><p class="minor">Consulta restricciones de rótulos, altura edificable de 23 ft, capacidad para construir hasta 4.500 ft², conexiones de servicios y cambios de tráfico previstos. La evaluación muestra las reglas verificables del piloto.</p>';
  if (!rules)
    body +=
      '<h3>Sucursales verificadas</h3><div class="source-list">' +
      branches
        .map((b) =>
          sr(
            b.name,
            b.address +
              " · coordenadas del enlace de indicaciones de la marca.",
            b.source,
            "Ficha oficial",
          ),
        )
        .join("") +
      '</div><h3>Mapa, direcciones y locales</h3><div class="source-list">' +
      sr(
        "Geografía del sur de Florida",
        "Mapa local TIGER/Line, calles y agua de 2024. Los límites ZCTA aproximan los códigos postales. La capa de calles en línea usa OpenStreetMap.",
        "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
        "U.S. Census Bureau",
      ) +
      sr(
        "Ubicación de direcciones",
        "Los localizadores públicos buscan direcciones en Miami-Dade y Broward. Puedes confirmar o ajustar el punto sobre el mapa.",
        "https://gisms.miamidade.gov/arcgis/rest/services/MDC_LocatorsPro/GeoAddress/GeocodeServer",
        "Miami-Dade GIS",
      ) +
      sr(
        "Terrenos en venta del condado",
        "Muestra de hasta ocho terrenos vacantes, ordenados por superficie total. Se cruzan el catálogo de venta, el inventario GIS y el catastro. La fecha de consulta corresponde a la extracción.",
        county.sale,
        "Catálogo de venta",
      ) +
      sr(
        "Datos abiertos y uso",
        "Miami-Dade permite descargar, visualizar, integrar y compartir los datos de su portal. Las ubicaciones y superficies son aproximadas.",
        county.reuse,
        "Miami-Dade Open Data Hub",
      ) +
      sr(
        "Inventario GIS",
        "County Owned Property identifica uso, folio y estado. Solo aparecen en Inventario los terrenos que también figuran en el catálogo de venta.",
        county.data,
        "County Owned Property",
      ) +
      "</div>";
  body +=
    '<p class="minor">Consulta de fuentes de la marca: ' +
    ddate(profile.checked) +
    ". La aprobación final corresponde a Culver’s.</p>";
  dialog(
    rules ? "Criterios de Culver’s" : "Fuentes y cobertura",
    profile.market + " · " + profile.format,
    body,
    rules ? "rules" : "sources",
  );
}
function updateLayers() {
  const el = $("#layer-panel");
  el.innerHTML =
    [
      ["branches", "Sucursales verificadas"],
      ["territories", "Territorios documentados"],
      ["detail", "Calles en línea · OSM"],
    ]
      .map(
        ([k, label]) =>
          '<label><input type="checkbox" data-layer="' +
          k +
          '" ' +
          (state[k] ? "checked" : "") +
          "> " +
          label +
          "</label>",
      )
      .join("") + btn("see-stores", "Ver las 3 sucursales", "store", "quiet");
}
function pick(id, on) {
  if (!item(id)) return;
  on ? state.selection.add(id) : state.selection.delete(id);
  drawCards();
  if (state.dialog === "compare") comparison();
}
function showEditor(c) {
  editor({
    c,
    dialog,
    geo: geography,
    onCleanup: (cb) => (state.cleanup = cb),
    onSave: async (record) => {
      const persist = async () => {
        let existing;
        try {
          existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
        } catch {
          throw Error("No se puede leer el archivo de locales guardados.");
        }
        if (!Array.isArray(existing))
          throw Error("No se puede leer el archivo de locales guardados.");
        if (c && existing.find((x) => x.id === c.id)?.revision !== c.revision)
          throw Error(
            "Este local cambió en otra pestaña. Abre la ficha actual antes de editar.",
          );
        if (!record.id) {
          record.id = crypto.randomUUID();
          record.number = Math.max(0, ...existing.map((v) => v.number)) + 1;
        }
        record.revision = crypto.randomUUID();
        const updated = [record, ...existing.filter((v) => v.id !== record.id)];
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          throw Error(
            "El navegador no pudo guardar los datos. Libera espacio y vuelve a intentar.",
          );
        }
        mine = updated;
      };
      if (navigator.locks) await navigator.locks.request(storageKey, persist);
      else await persist();
      state.mode = "mine";
      cancelDraw();
      setZone(null, false);
      state.focus = record.id;
      render();
      map.setView([record.lat, record.lng], 13);
      showDetail(record.id);
      toast("Local guardado y evaluado.");
    },
  });
}
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.matches("[data-pick]")) pick(t.dataset.pick, t.checked);
  if (t.matches("[data-layer]")) {
    state[t.dataset.layer] = t.checked;
    if (t.dataset.layer === "detail") mainMap.setDetail(t.checked);
    drawMap();
  }
});
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-do]");
  if (!t) return;
  const a = t.dataset.do,
    id = t.dataset.id;
  if (
    [
      "demo",
      "inventory",
      "mine",
      "fit",
      "draw",
      "layers",
      "see-stores",
      "reset-zone",
    ].includes(a) &&
    a !== "draw" &&
    state.draw
  )
    cancelDraw();
  switch (a) {
    case "explore":
      close();
      break;
    case "review":
      showReview();
      break;
    case "brand-reply":
      recordBrandReply(item(id));
      break;
    case "reload-inventory":
      loadInventory();
      break;
    case "inventory":
    case "demo":
    case "mine":
      state.mode = a;
      state.focus = null;
      render();
      fit();
      break;
    case "add":
      showEditor(null);
      break;
    case "edit":
      showEditor(item(id));
      break;
    case "close":
      close();
      break;
    case "sources":
      sources();
      break;
    case "rules":
      sources(true);
      break;
    case "detail":
      showDetail(id);
      break;
    case "compare":
      comparison();
      break;
    case "toggle-compare":
      pick(id, !state.selection.has(id));
      showDetail(id);
      break;
    case "export":
      exportCsv();
      break;
    case "locate": {
      const c = item(id);
      close();
      map.setView([c.lat, c.lng], 14);
      break;
    }
    case "territory-map": {
      const c = item(id),
        r = evaluate(c).rows.find((r) => r.key === "territory"),
        b = r.branch || nearest(c);
      state.territories = true;
      state.branches = true;
      drawMap();
      close();
      const bounds = L.latLngBounds([[c.lat, c.lng]]);
      if (c.territory?.geometry)
        bounds.extend(L.geoJSON(c.territory.geometry).getBounds());
      else if (b) bounds.extend([b.lat, b.lng]);
      map.fitBounds(bounds, { padding: [45, 55], maxZoom: 13 });
      break;
    }
    case "zoom-in":
      map.zoomIn();
      break;
    case "zoom-out":
      map.zoomOut();
      break;
    case "fit":
      fit();
      break;
    case "reset-zone":
      setZone(null);
      break;
    case "layers": {
      const el = $("#layer-panel");
      el.hidden = !el.hidden;
      t.setAttribute("aria-expanded", String(!el.hidden));
      updateLayers();
      break;
    }
    case "see-stores":
      state.branches = true;
      drawMap();
      $("#layer-panel").hidden = true;
      map.fitBounds(
        branches.map((b) => [b.lat, b.lng]),
        { padding: [45, 45] },
      );
      break;
    case "draw":
      drawMode();
      break;
    case "undo":
      state.draw?.pop();
      drawGuide();
      break;
    case "finish":
      finishDraw();
      break;
    case "cancel-draw":
      cancelDraw();
      break;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (state.draw) cancelDraw();
    $("#layer-panel").hidden = true;
  }
});
window.addEventListener("storage", (e) => {
  if (e.key?.startsWith("franchmap.brandReply.v1.")) {
    render();
    if (state.dialog === "detail") showDetail(state.focus);
  }
  if (e.key === storageKey) {
    try {
      mine = JSON.parse(e.newValue || "[]");
      state.selection.forEach((id) => {
        if (!item(id)) state.selection.delete(id);
      });
      render();
    } catch {
      toast("No se pudieron actualizar los locales guardados.");
    }
  }
});
async function loadInventory() {
  try {
    const response = await fetch("data/inventory.json", { cache: "no-cache" });
    if (!response.ok) throw Error();
    const data = await response.json();
    if (data.version !== 1 || !Array.isArray(data.records) || !data.imports)
      throw Error();
    inventory = data;
    inventoryError = false;
  } catch {
    inventoryError = true;
  }
  loadedInventory = true;
  render();
  if (state.mode === "inventory") fit();
  if (!inventoryError && window.location.hash === "#consultas") showReview();
  const parcel = window.location.hash.match(/^#parcela=(mdc:\d{13})$/);
  if (parcel && item(parcel[1])) showDetail(parcel[1]);
}
render();
loadInventory();
if (storeIssue)
  toast("No se pudo leer el almacenamiento de locales del navegador.");
