import {
  profile,
  fields,
  branches,
  validShape,
  safeUrl,
  inGeometry,
} from "./model.mjs";
import { createMap, pin, lookupAddress, scopeContains, esc } from "./maps.mjs";
import { icon } from "./icons.mjs";
const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
const input = (id, label, value = "", opts = "") =>
  "<label><span>" +
  esc(label) +
  '</span><input name="' +
  id +
  '" value="' +
  esc(value ?? "") +
  '" ' +
  opts +
  "></label>";
const select = (id, label, options, value) =>
  "<label><span>" +
  esc(label) +
  '</span><select name="' +
  id +
  '">' +
  options
    .map(
      ([key, name]) =>
        '<option value="' +
        esc(key) +
        '" ' +
        (String(value ?? "") === key ? "selected" : "") +
        ">" +
        esc(name) +
        "</option>",
    )
    .join("") +
  "</select></label>";
const list = (opts) => opts.map((x) => [x, x]);
const details = (title, body, open = false) =>
  '<details class="span2" ' +
  (open ? "open" : "") +
  "><summary>" +
  esc(title) +
  '</summary><div class="form-grid">' +
  body +
  "</div></details>";
export function editor({ c, dialog, geo, onCleanup, onSave }) {
  const v = c?.values || {},
    oldT = c?.territory || {};
  let alive = true,
    mini,
    marker,
    point = c ? { lat: c.lat, lng: c.lng } : null,
    resolved = [],
    lastSearch = 0;
  const metrics = fields
    .map(([key, name, u]) =>
      u === "sí/no"
        ? select(
            key,
            name,
            [
              ["", "Sin confirmar"],
              ["true", "Sí"],
              ["false", "No"],
            ],
            v[key],
          )
        : input(
            key,
            name + " (" + u + ")",
            v[key],
            'type="number" min="' +
              (key === "seats" ? "1" : "0") +
              '" step="' +
              (["area", "totalArea", "buildingArea", "front", "speed"].includes(
                key,
              )
                ? "any"
                : "1") +
              '"',
          ),
    )
    .join("");
  const sourceFields =
    select(
      "sourceType",
      "Origen de los datos modificados",
      list(["Usuario", "Anuncio", "Marca"]),
      c?.sourceType || "Usuario",
    ) +
    input(
      "sourceUrl",
      "Enlace de la evidencia",
      c?.sourceUrl,
      'type="url" placeholder="https://…"',
    ) +
    input(
      "sourceDate",
      "Fecha de los datos",
      c?.date || today(),
      'type="date" required max="' + today() + '"',
    );
  const listings =
    select(
      "operation",
      "Operación",
      list(["Sin indicar", "Alquiler", "Venta"]),
      c?.operation || "Sin indicar",
    ) +
    select(
      "availability",
      "Disponibilidad reportada",
      list(["Sin confirmar", "Disponible", "En negociación", "Retirado"]),
      c?.availability || "Sin confirmar",
    ) +
    input(
      "price",
      "Precio (USD)",
      c?.price,
      'type="number" min="0" step="any"',
    ) +
    select(
      "priceUnit",
      "Unidad del precio",
      [
        ["", "Seleccionar unidad"],
        ...list([
          "total",
          "/ mes",
          "/ año",
          "/ ft² / año",
          "/ ft² / mes",
          "/ ft²",
        ]),
      ],
      c?.priceUnit,
    ) +
    input(
      "listingUrl",
      "Enlace del anuncio",
      c?.listingUrl,
      'type="url" placeholder="https://…"',
    ) +
    input(
      "listingDate",
      "Fecha del anuncio o verificación",
      c?.listingDate,
      'type="date" max="' + today() + '"',
    );
  const territory =
    select(
      "method",
      "Método indicado por la marca",
      [
        ["", "Sin regla documentada"],
        ["boundary", "Límites en plano territorial"],
        ["straight", "Distancia en línea recta"],
        ["road", "Distancia por carretera"],
      ],
      oldT.method,
    ) +
    input(
      "territorySource",
      "Documento de la marca para este sitio",
      oldT.source,
      'type="url" placeholder="https://…"',
    ) +
    input(
      "territoryDate",
      "Fecha de la regla aplicable",
      oldT.date,
      'type="date" max="' + today() + '"',
    ) +
    '<div id="distance-field">' +
    input(
      "minKm",
      "Separación mínima, en kilómetros",
      oldT.minKm,
      'type="number" min="0.001" step="any"',
    ) +
    '</div><label class="span2" id="shape-field"><span>Territorios protegidos (GeoJSON Polygon o MultiPolygon, WGS84)</span><textarea name="shape" rows="3" placeholder="Pega la geometría del plano documentado.">' +
    esc(oldT.geometry ? JSON.stringify(oldT.geometry) : "") +
    '</textarea></label><div id="routes" class="span2"><p class="minor">Distancias de conducción documentadas desde el terreno a cada sucursal. Incluye un enlace al itinerario.</p><div class="form-grid">' +
    branches
      .map((b, i) => {
        const r = oldT.routes?.find((r) => r.name === b.name);
        return (
          input(
            "route" + i,
            b.name + " (km)",
            r?.km,
            'type="number" min="0" step="any"',
          ) +
          input(
            "routeUrl" + i,
            "Itinerario · " + b.name,
            r?.source,
            'type="url"',
          )
        );
      })
      .join("") +
    '</div></div><label class="span2"><span><input type="checkbox" style="width:auto" name="complete" ' +
    (oldT.complete ? "checked" : "") +
    "> El documento confirma que la cobertura territorial o la lista de sucursales utilizada está completa para este sitio.</span></label>";
  const form =
    '<form id="candidate-form"><div class="form-grid"><div class="span2">' +
    input(
      "address",
      "Dirección del inmueble *",
      c?.address,
      'required autocomplete="off" maxlength="220" placeholder="Número, calle y ciudad"',
    ) +
    '</div><div class="span2"><button type="button" id="find-address" class="secondary">' +
    icon("search", 16) +
    'Localizar dirección</button><span id="geo-msg" class="minor" role="status"> ' +
    (point ? "Punto guardado." : "También puedes marcar el punto en el mapa.") +
    '</span><div id="geo-options"></div></div><div class="span2"><div id="edit-map" class="mapmini" aria-label="Mapa para confirmar el inmueble"></div><p class="minor" id="coord-msg" aria-live="polite"></p></div>' +
    details(
      "Introducir coordenadas exactas",
      input(
        "latitude",
        "Latitud",
        c?.lat,
        'type="number" step="any" min="-90" max="90"',
      ) +
        input(
          "longitude",
          "Longitud",
          c?.lng,
          'type="number" step="any" min="-180" max="180"',
        ) +
        '<button type="button" class="secondary" id="use-coords">Confirmar punto</button>',
    ) +
    input(
      "name",
      "Nombre del candidato",
      c?.name,
      'maxlength="100" placeholder="Por ejemplo, lote de la avenida"',
    ) +
    input("city", "Ciudad o localidad", c?.city, 'maxlength="100"') +
    input(
      "zip",
      "Código postal",
      c?.zip,
      'inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="33101"',
    ) +
    details("Datos del terreno y requisitos de la marca", metrics, true) +
    details("Fuente de los datos", sourceFields, !!c) +
    details("Anuncio, disponibilidad y precio", listings) +
    details("Documento territorial específico", territory) +
    '</div><p class="form-error" role="alert" id="form-error"></p><div class="dialog-actions"><button type="submit" class="primary">' +
    icon("check", 16) +
    'Guardar y evaluar</button><button type="button" class="secondary" data-do="close">Cancelar</button></div></form>';
  dialog(
    c ? "Editar local" : "Agregar local",
    profile.brand + " · " + profile.market + " · " + profile.format,
    form,
    "edit",
  );
  const f = document.getElementById("candidate-form"),
    el = (id) => f.querySelector("#" + id),
    val = (name) => f.elements.namedItem(name)?.value.trim() || "",
    err = (msg) => (el("form-error").textContent = msg);
  mini = createMap("edit-map", { mini: true });
  L.control
    .zoom({
      position: "topright",
      zoomInTitle: "Acercar",
      zoomOutTitle: "Alejar",
    })
    .addTo(mini.m);
  let geoData;
  function mark(p, zoom = false) {
    if (
      c &&
      point &&
      (p.lat !== c.lat || p.lng !== c.lng) &&
      f.elements.method.value
    ) {
      f.elements.method.value = "";
      f.elements.complete.checked = false;
      changeTerritory();
    }
    point = { lat: p.lat, lng: p.lng };
    f.elements.latitude.value = p.lat;
    f.elements.longitude.value = p.lng;
    if (marker) marker.remove();
    marker = pin([p.lat, p.lng]).addTo(mini.m);
    if (zoom) mini.m.setView([p.lat, p.lng], 15);
    el("coord-msg").textContent =
      "Punto confirmado · " + p.lat.toFixed(5) + ", " + p.lng.toFixed(5);
    if (geoData) {
      for (const t of ["city", "zip"]) {
        const fz = geoData.zones.find(
          (z) =>
            z.properties.type === t && inGeometry([p.lng, p.lat], z.geometry),
        );
        f.elements[t].value = fz?.properties.name || "";
      }
    }
  }
  geo
    .then((g) => {
      if (!alive) return;
      geoData = g;
      if (point && !c) mark(point);
    })
    .catch(() => {});
  if (point) mark(point, true);
  else
    el("coord-msg").textContent = "Selecciona la ubicación exacta del terreno.";
  el("use-coords").onclick = () => {
    const lat = Number(val("latitude")),
      lng = Number(val("longitude"));
    if (
      !val("latitude") ||
      !val("longitude") ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      err("Introduce coordenadas válidas.");
      return;
    }
    mark({ lat, lng }, true);
    err("");
  };
  mini.m.on("click", (e) => {
    mark(e.latlng);
    err("");
  });
  requestAnimationFrame(() => {
    if (alive) mini.m.invalidateSize();
  });
  f.elements.address.addEventListener("input", () => {
    f.elements.method.value = "";
    f.elements.complete.checked = false;
    changeTerritory();
    lastSearch++;
    resolved = [];
    el("geo-options").innerHTML = "";
    if (marker) {
      marker.remove();
      marker = null;
    }
    point = null;
    f.elements.latitude.value = "";
    f.elements.longitude.value = "";
    el("coord-msg").textContent =
      "Confirma de nuevo el punto para esta dirección.";
  });
  el("find-address").onclick = async () => {
    const q = val("address");
    if (!q) {
      f.elements.address.reportValidity();
      return;
    }
    const seq = ++lastSearch;
    el("geo-msg").textContent = " Consultando al condado…";
    el("geo-options").innerHTML = "";
    try {
      const found = await lookupAddress(q);
      if (!alive || seq !== lastSearch) return;
      resolved = found;
      el("geo-msg").textContent = found.length
        ? " Elige la coincidencia correcta o marca un punto en el mapa."
        : " No se encontró una dirección exacta. Marca el inmueble en el mapa.";
      el("geo-options").innerHTML = found
        .map(
          (x, i) =>
            '<button type="button" class="small-btn" data-geo="' +
            i +
            '">' +
            icon("pin", 14) +
            esc(x.name) +
            "</button>",
        )
        .join("");
    } catch {
      if (alive && seq === lastSearch)
        el("geo-msg").textContent =
          " Localizador no disponible. Marca el inmueble en el mapa.";
    }
  };
  el("geo-options").onclick = (e) => {
    const b = e.target.closest("[data-geo]");
    if (b) {
      const p = resolved[Number(b.dataset.geo)];
      mark(p, true);
      el("geo-msg").textContent = " Ubicación confirmada.";
      el("geo-options").innerHTML = "";
    }
  };
  function changeTerritory() {
    const m = val("method");
    el("shape-field").hidden = m !== "boundary";
    el("distance-field").hidden = !["road", "straight"].includes(m);
    el("routes").hidden = m !== "road";
  }
  f.elements.method.onchange = changeTerritory;
  changeTerritory();
  f.onsubmit = async (e) => {
    e.preventDefault();
    err("");
    try {
      if (!point)
        throw Error(
          "Confirma la ubicación exacta en el mapa antes de guardar.",
        );
      const { counties } = await geo;
      if (!alive) return;
      if (!scopeContains(point, counties))
        throw Error(
          "El piloto evalúa propiedades de Miami-Dade y Broward. Revisa el punto en el mapa.",
        );
      if (val("sourceType") !== "Usuario" && !safeUrl(val("sourceUrl")))
        throw Error(
          "Añade el enlace de la evidencia del anuncio o de la marca en «Fuente de los datos».",
        );
      if (
        (val("sourceUrl") && !safeUrl(val("sourceUrl"))) ||
        (val("listingUrl") && !safeUrl(val("listingUrl")))
      )
        throw Error("Los enlaces deben comenzar por https:// o http://.");
      if (val("price") && !val("priceUnit"))
        throw Error(
          "Indica si el precio es total, periódico o por pie cuadrado.",
        );
      if (
        val("availability") !== "Sin confirmar" &&
        (!safeUrl(val("listingUrl")) || !val("listingDate"))
      )
        throw Error(
          "Para marcar disponibilidad se necesita la fuente y la fecha del anuncio.",
        );
      const values = {},
        provenance = { ...c?.provenance };
      const src = {
        type: val("sourceType"),
        url: val("sourceUrl"),
        date: val("sourceDate"),
      };
      for (const [key, , unit] of fields) {
        const raw = val(key);
        values[key] =
          raw === "" ? null : unit === "sí/no" ? raw === "true" : Number(raw);
        if (v[key] !== values[key] || !provenance[key]) provenance[key] = src;
      }
      if (
        values.area != null &&
        values.totalArea != null &&
        values.area > values.totalArea
      )
        throw Error(
          "El terreno útil supera el terreno total. Revisa las medidas.",
        );
      const method = val("method");
      let territory = null;
      if (method) {
        if (!safeUrl(val("territorySource")) || !val("territoryDate"))
          throw Error("Añade el documento territorial de la marca y su fecha.");
        territory = {
          method,
          source: val("territorySource"),
          date: val("territoryDate"),
          complete: f.elements.complete.checked,
        };
        if (method === "boundary") {
          let shape;
          try {
            shape = JSON.parse(val("shape"));
          } catch {
            throw Error("Pega un GeoJSON válido del territorio protegido.");
          }
          if (shape.type === "Feature") shape = shape.geometry;
          if (!validShape(shape))
            throw Error(
              "El plano debe ser un Polygon o MultiPolygon con anillos cerrados y coordenadas válidas.",
            );
          territory.geometry = shape;
        } else {
          if (!val("minKm") || Number(val("minKm")) <= 0)
            throw Error("Indica la distancia mínima indicada por la marca.");
          territory.minKm = Number(val("minKm"));
          if (method === "road") {
            territory.routes = [];
            branches.forEach((b, i) => {
              const r = val("route" + i),
                url = val("routeUrl" + i);
              if (r || url) {
                if (r === "" || !safeUrl(url))
                  throw Error(
                    "Para cada ruta añade kilometraje y enlace al itinerario.",
                  );
                territory.routes.push({
                  name: b.name,
                  km: Number(r),
                  source: url,
                });
              }
            });
          }
        }
      }
      await onSave({
        id: c?.id,
        number: c?.number,
        name: val("name") || val("address"),
        address: val("address"),
        city: val("city"),
        zip: val("zip"),
        ...point,
        values,
        provenance,
        sourceType: src.type,
        sourceUrl: src.url,
        date: src.date,
        demo: false,
        operation: val("operation"),
        availability: val("availability"),
        price: val("price") === "" ? null : Number(val("price")),
        priceUnit: val("priceUnit"),
        listingUrl: val("listingUrl"),
        listingDate: val("listingDate"),
        territory,
      });
    } catch (error) {
      err(error.message);
      el("form-error").scrollIntoView({ block: "nearest" });
    }
  };
  onCleanup(() => {
    alive = false;
    mini.destroy();
  });
}
