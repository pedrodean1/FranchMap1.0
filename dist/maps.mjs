import { icon } from "./icons.mjs";
import { branches, inGeometry } from "./model.mjs";
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const load = (name) =>
  fetch("data/" + name + ".geojson").then((r) => {
    if (!r.ok) throw Error("Cartografía no disponible");
    return r.json();
  });
export const geography = Promise.all([
  load("miami-basemap"),
  load("zones"),
  load("counties"),
]).then(([base, zones, county]) => ({
  base,
  zones: zones.features,
  counties: county.features,
}));
const center = [25.798, -80.27];
const blue = "#bcd9df";
const paint = {
  water: { fillColor: blue, color: blue, weight: 0.4 },
  park: { fillColor: "#d0e0be", color: "#c4d6b8", weight: 0.5 },
  airport: { fillColor: "#dae0d4", color: "#b9c7b7", weight: 0.8 },
  street: { color: "#fbfcf5", weight: 1.25 },
  arterial: { color: "#faf7dc", weight: 2.1 },
  highway: { color: "#f9df99", weight: 2.6 },
};
const makeIcon = (html, size, anchor) =>
  L.divIcon({ className: "", html, iconSize: size, iconAnchor: anchor });
export function createMap(id, { mini = false } = {}) {
  const m = L.map(id, {
    zoomControl: false,
    zoomSnap: 0.25,
    zoomDelta: 1,
    minZoom: 8,
    maxZoom: 19,
    preferCanvas: true,
    scrollWheelZoom: !mini,
    attributionControl: true,
  }).setView(center, mini ? 10.25 : window.innerWidth < 720 ? 10 : 10.75);
  m.attributionControl.setPrefix(false);
  m.attributionControl.addAttribution(
    '<a href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" target="_blank" rel="noopener">U.S. Census · TIGER/Line</a>',
  );
  m.createPane("geoBase");
  m.getPane("geoBase").style.zIndex = 350;
  m.createPane("geolabels");
  m.getPane("geolabels").style.zIndex = 365;
  m.getPane("geolabels").style.pointerEvents = "none";
  let regionLayer,
    labelLayer = L.layerGroup().addTo(m),
    detailLayer = null,
    manualDetail = false,
    externalFailure = false,
    alive = true;
  const viewport = L.latLngBounds([25.35, -80.68], [26.36, -80.035]);
  const drawLabels = (base) => {
    labelLayer.clearLayers();
    const z = m.getZoom(),
      bounds = m.getBounds(),
      selected = [],
      items = base.features
        .filter((f) => f.properties.kind === "place")
        .sort((a, b) => a.properties.rank - b.properties.rank);
    for (const f of items) {
      const { name, rank } = f.properties;
      if (
        (rank > 1 && z < 10.5) ||
        (rank > 2 && z < 11.5) ||
        (z < 9.6 &&
          rank === 1 &&
          !["Miami", "Fort Lauderdale", "Homestead"].includes(name))
      )
        continue;
      const [lng, lat] = f.geometry.coordinates,
        ll = L.latLng(lat, lng);
      if (!bounds.contains(ll)) continue;
      const pt = m.latLngToContainerPoint(ll),
        width = name.length * 7.6 + 10;
      if (
        selected.some(
          (s) =>
            Math.abs(pt.y - s.y) < 23 &&
            Math.abs(pt.x - s.x) < (width + s.w) / 2,
        )
      )
        continue;
      selected.push({ x: pt.x, y: pt.y, w: width });
      L.marker(ll, {
        pane: "geolabels",
        interactive: false,
        keyboard: false,
        icon: makeIcon(
          '<div class="geo-name loc-label ' +
            (rank === 1 ? "loc-major" : "") +
            '">' +
            esc(name) +
            "</div>",
          [0, 0],
          [0, 0],
        ),
      }).addTo(labelLayer);
    }
    for (const [name, lat, lng] of [
      ["Biscayne Bay", 25.754, -80.171],
      ["Atlantic Ocean", 25.855, -80.065],
    ]) {
      if (bounds.contains([lat, lng]))
        L.marker([lat, lng], {
          pane: "geolabels",
          interactive: false,
          keyboard: false,
          icon: makeIcon(
            '<div class="water-label">' + name + "</div>",
            [0, 0],
            [0, 0],
          ),
        }).addTo(labelLayer);
    }
  };
  function updateTiles() {
    const need =
      manualDetail || m.getZoom() >= 13 || !viewport.contains(m.getCenter());
    if (need && !detailLayer && !externalFailure) {
      detailLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        },
      );
      if (!m.getPane("detailTiles")) m.createPane("detailTiles");
      m.getPane("detailTiles").style.zIndex = 390;
      m.getPane("detailTiles").style.pointerEvents = "none";
      detailLayer.options.pane = "detailTiles";
      let loaded = false;
      detailLayer.once("tileload", () => {
        loaded = true;
      });
      detailLayer.on("tileerror", () => {
        if (!loaded && detailLayer) {
          m.removeLayer(detailLayer);
          detailLayer = null;
          externalFailure = true;
        }
      });
      detailLayer.addTo(m);
    } else if (!need && detailLayer) {
      detailLayer.remove();
      detailLayer = null;
    }
  }
  geography
    .then(({ base }) => {
      if (!alive) return;
      // The Census extract stops offshore. Continue the ocean fill past its eastern clip.
      L.rectangle(
        [
          [viewport.getSouth(), viewport.getEast()],
          [viewport.getNorth(), -78],
        ],
        {
          pane: "geoBase",
          interactive: false,
          stroke: false,
          fillColor: blue,
          fillOpacity: 1,
        },
      ).addTo(m);
      regionLayer = L.geoJSON(base, {
        pane: "geoBase",
        filter: (f) => f.properties.kind !== "place",
        style: (f) => ({
          interactive: false,
          fillOpacity: 1,
          opacity: 1,
          ...paint[f.properties.kind],
        }),
        interactive: false,
      }).addTo(m);

      drawLabels(base);
      updateTiles();
      m.on("moveend zoomend", () => {
        drawLabels(base);
        updateTiles();
      });
    })
    .catch(() => {
      if (alive) {
        manualDetail = true;
        updateTiles();
      }
    });
  if (!mini)
    L.control
      .scale({
        imperial: true,
        metric: false,
        position: "bottomleft",
        maxWidth: 80,
      })
      .addTo(m);
  return {
    m,
    setDetail: (on) => {
      manualDetail = on;
      externalFailure = false;
      updateTiles();
    },
    destroy: () => {
      alive = false;
      m.remove();
    },
  };
}
export function candidateMarker(c, state) {
  return L.marker([c.lat, c.lng], {
    title: c.name,
    alt: c.name,
    icon: makeIcon(
      '<div class="number-pin ' +
        state +
        '-pin"><span>' +
        String(c.number).padStart(2, "0") +
        "</span></div>",
      [32, 32],
      [13, 33],
    ),
    zIndexOffset: 100,
  });
}
export const branchMarker = (b) =>
  L.marker([b.lat, b.lng], {
    title: "Culver’s · " + b.name,
    alt: "Sucursal " + b.name,
    icon: makeIcon(
      '<div class="branch-pin">' + icon("store", 16) + "</div>",
      [30, 30],
      [15, 15],
    ),
  }).bindPopup(
    '<div class="map-tip"><strong>Culver’s · ' +
      esc(b.name) +
      "</strong><p>" +
      esc(b.address) +
      '</p><a target="_blank" rel="noopener" href="' +
      esc(b.source) +
      '">Ficha oficial de la sucursal</a></div>',
  );
export const pin = (point) =>
  L.marker(point, {
    icon: makeIcon(
      '<div class="confirm-pin">' + icon("pin", 18) + "</div>",
      [30, 30],
      [15, 15],
    ),
  });
export const territoryStyle = {
  color: "#785391",
  fillColor: "#aa8dc7",
  weight: 2,
  dashArray: "6 5",
  fillOpacity: 0.18,
};
export const zoneStyle = {
  color: "#267258",
  fillColor: "#69ac82",
  weight: 2,
  dashArray: "7 5",
  fillOpacity: 0.07,
  interactive: false,
};
export function scopeContains(loc, counties) {
  return counties.some((f) => inGeometry([loc.lng, loc.lat], f.geometry));
}
export async function lookupAddress(query) {
  const endpoints = [
    "https://gisms.miamidade.gov/arcgis/rest/services/MDC_LocatorsPro/GeoAddress/GeocodeServer",
    "https://gisws.miamidade.gov/arcgis/rest/services/MDC_Locators/BrowardLocator/GeocodeServer",
  ];
  const { counties } = await geography;
  const searches = await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const url = new URL(endpoint + "/findAddressCandidates");
      for (const [k, v] of Object.entries({
        SingleLine: query,
        f: "json",
        outSR: "4326",
        maxLocations: "4",
      }))
        url.searchParams.set(k, v);
      const res = await fetch(url, { signal: AbortSignal.timeout(7500) });
      if (!res.ok) throw Error("Localizador no disponible");
      const data = await res.json();
      if (data.error) throw Error("Localizador no disponible");
      return (data.candidates || [])
        .filter(
          (c) =>
            c.score >= 80 &&
            c.location &&
            scopeContains({ lng: c.location.x, lat: c.location.y }, counties),
        )
        .map((c) => ({
          name: c.address,
          lat: c.location.y,
          lng: c.location.x,
          score: c.score,
        }));
    }),
  );
  if (searches.every((s) => s.status === "rejected"))
    throw Error("Localizadores no disponibles");
  return searches
    .flatMap((s) => (s.status === "fulfilled" ? s.value : []))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
