export const profile = {
  brand: "Culver’s",
  market: "Miami–Fort Lauderdale",
  format: "Independiente con drive-thru",
  checked: "2026-11-22",
  realEstate: "https://www.culvers.com/franchise/real-estate",
  markets: "https://www.culvers.com/franchise/available-franchise-markets",
  territory:
    "https://storage.googleapis.com/franchiseindx_fdds/Food-Beverage/Culver%E2%80%99s_2026_ijNDHQWz",
};
export const branches = [
  [
    "Cooper City",
    "3700 University Drive",
    26.04019928,
    -80.25050354,
    "cooper-city-university-dr",
  ],
  [
    "Tamarac",
    "8251 W Commercial Blvd",
    26.1941967,
    -80.26050568,
    "tamarac-fl-w-commercial-blvd",
  ],
  [
    "Margate",
    "5510 W Copans Rd",
    26.2538929,
    -80.19963837,
    "margate-fl-copans-rd",
  ],
].map(([name, address, lat, lng, slug]) => ({
  name,
  address,
  lat,
  lng,
  source: "https://www.culvers.com/restaurants/" + slug,
}));
export const statuses = {
  good: {
    label: "Compatible según los datos disponibles",
    short: "Compatible",
    action: "Coordina una visita y solicita la revisión final de Culver’s.",
  },
  pending: { label: "Pendiente de verificar", short: "Pendiente de verificar" },
  bad: { label: "Descartado", short: "Descartado" },
};
export const fields = [
  ["area", "Terreno útil", "ft²"],
  ["front", "Frente", "ft"],
  ["traffic", "Tráfico diario", "vehículos/día"],
  ["drive", "Zonificación para drive-thru", "sí/no"],
  ["stalls", "Plazas de estacionamiento", "plazas"],
  ["seats", "Asientos previstos", "asientos"],
  ["speed", "Límite de velocidad", "mph"],
  ["corner", "Esquina con semáforo", "sí/no"],
  ["access", "Puntos de entrada y salida", "accesos"],
  ["visibility", "Buena visibilidad desde todos los ángulos", "sí/no"],
  ["left", "Giro a la izquierda al entrar y salir", "sí/no"],
];
const quantity = new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 });
export const fmt = (n) => quantity.format(n);
export const isNum = (n) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
export const formVal = (key, v) =>
  v === null || v === undefined || v === ""
    ? "Sin documentar"
    : typeof v === "boolean"
      ? v
        ? "Sí"
        : "No"
      : fmt(v) + " " + (fields.find((f) => f[0] === key)?.[2] || "");
export function distance(a, b) {
  const rad = Math.PI / 180,
    sinLat = Math.sin(((b.lat - a.lat) * rad) / 2),
    sinLng = Math.sin(((b.lng - a.lng) * rad) / 2);
  return (
    12742 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          sinLat * sinLat +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * sinLng * sinLng,
        ),
      ),
    )
  );
}
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j],
      [bx, by] = ring[i],
      cross = (y - ay) * (bx - ax) - (x - ax) * (by - ay);
    if (
      Math.abs(cross) < 1e-10 &&
      x >= Math.min(ax, bx) &&
      x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) &&
      y <= Math.max(ay, by)
    )
      return true;
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside;
  }
  return inside;
}
export function inGeometry(point, geom) {
  if (!geom) return false;
  const polys =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  return polys.some(
    (poly) =>
      inRing(point, poly[0]) &&
      !poly.slice(1).some((hole) => inRing(point, hole)),
  );
}
export function validShape(g) {
  if (!g || !["Polygon", "MultiPolygon"].includes(g.type)) return false;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return (
    Array.isArray(polys) &&
    polys.length > 0 &&
    polys.every(
      (p) =>
        Array.isArray(p) &&
        p.length > 0 &&
        p.every(
          (r) =>
            Array.isArray(r) &&
            r.length >= 4 &&
            r.every(
              (pt) =>
                Array.isArray(pt) &&
                pt.length === 2 &&
                Number.isFinite(pt[0]) &&
                Math.abs(pt[0]) <= 180 &&
                Number.isFinite(pt[1]) &&
                Math.abs(pt[1]) <= 90,
            ) &&
            Math.abs(
              r
                .slice(1)
                .reduce(
                  (area, b, i) =>
                    area +
                    (r[i][0] - r[0][0]) * (b[1] - r[0][1]) -
                    (b[0] - r[0][0]) * (r[i][1] - r[0][1]),
                  0,
                ),
            ) > 1e-14 &&
            r[0][0] === r.at(-1)[0] &&
            r[0][1] === r.at(-1)[1],
        ),
    )
  );
}
export function nearest(c, list = branches) {
  return list
    .map((b) => ({ ...b, km: distance(c, b) }))
    .sort((a, b) => a.km - b.km)[0];
}
function territoryRow(c, list) {
  const row = {
    key: "territory",
    name: "Separación territorial",
    kind: "Obligatorio",
    expected: "Límite aplicable al emplazamiento",
    actual: "Falta la delimitación aplicable",
    verdict: null,
    ruleSource: profile.territory,
    ask: "Pide a la franquicia el plano territorial aplicable a esta dirección.",
    inputs: [],
  };
  const t = c.territory;
  if (!t?.source || !t.date || (!c.demo && !/^https?:\/\//i.test(t.source)))
    return row;
  row.evidence = t;
  if (t.method === "boundary" && validShape(t.geometry)) {
    const within = inGeometry([c.lng, c.lat], t.geometry);
    row.expected = "Fuera del territorio protegido documentado";
    row.actual = within
      ? "Dentro del territorio"
      : "Fuera del territorio aportado";
    row.verdict = within ? false : t.complete ? true : null;
  } else if (t.method === "straight" && isNum(t.minKm)) {
    const closest = nearest(c, list);
    row.expected = "Distancia en línea recta ≥ " + fmt(t.minKm) + " km";
    if (closest) {
      row.actual = fmt(closest.km) + " km · " + closest.name;
      row.verdict = closest.km < t.minKm ? false : t.complete ? true : null;
      row.branch = closest;
    }
  } else if (t.method === "road" && isNum(t.minKm)) {
    row.expected = "Distancia por carretera ≥ " + fmt(t.minKm) + " km";
    const records = (t.routes || [])
      .filter(
        (r) => isNum(r.km) && r.source && list.some((b) => b.name === r.name),
      )
      .sort((a, b) => a.km - b.km);
    if (records.length) {
      const first = records[0];
      row.actual = fmt(first.km) + " km por carretera · " + first.name;
      row.branch = list.find((b) => b.name === first.name);
      row.routeSource = first.source;
      row.verdict =
        first.km < t.minKm
          ? false
          : t.complete &&
              list.length > 0 &&
              list.every((b) => records.some((r) => r.name === b.name))
            ? true
            : null;
    }
  }
  return row;
}
export function evaluate(c, list = branches) {
  const d = c.values || {},
    rows = [];
  function row(
    key,
    name,
    kind,
    expected,
    verdict,
    ask,
    inputs = [key],
    actual = formVal(key, d[key]),
  ) {
    rows.push({
      key,
      name,
      kind,
      expected,
      verdict,
      ask,
      inputs,
      actual,
      ruleSource: profile.realEstate,
    });
  }
  for (const [key, label, min, pref, unit, q] of [
    [
      "area",
      "Superficie útil del terreno",
      45000,
      50000,
      "ft²",
      "Pide al agente la superficie útil del terreno, descontando las áreas no aprovechables.",
    ],
    [
      "front",
      "Frente del terreno",
      150,
      175,
      "ft",
      "Pide al agente el plano con las medidas del frente.",
    ],
    [
      "traffic",
      "Tráfico diario medio",
      15000,
      30000,
      "vehículos/día",
      "Solicita el aforo medio diario del tramo que da frente al terreno.",
    ],
  ]) {
    row(
      key,
      label,
      "Obligatorio",
      "≥ " + fmt(min) + " " + unit,
      isNum(d[key]) ? d[key] >= min : null,
      q,
    );
    row(
      key + "Pref",
      label + " preferido",
      "Preferido",
      "≥ " + fmt(pref) + " " + unit,
      isNum(d[key]) ? d[key] >= pref : null,
      q,
      [key],
      formVal(key, d[key]),
    );
  }
  row(
    "drive",
    "Zonificación drive-thru",
    "Obligatorio",
    "Uso permitido",
    typeof d.drive === "boolean" ? d.drive : null,
    "Pide confirmación escrita de que la zonificación permite el drive-thru.",
  );
  const parking = isNum(d.seats) && d.seats > 0 && isNum(d.stalls);
  row(
    "parking",
    "Estacionamiento",
    "Obligatorio",
    "1 plaza por cada 2 asientos",
    parking ? d.stalls >= Math.ceil(d.seats / 2) : null,
    "Confirma cuántas plazas y asientos figuran en el plano.",
    ["stalls", "seats"],
    parking
      ? fmt(d.stalls) + " plazas / " + fmt(d.seats) + " asientos"
      : "Plazas: " + (d.stalls ?? "—") + " · asientos: " + (d.seats ?? "—"),
  );
  for (const [key, name, expected, test] of [
    ["speed", "Velocidad frente al sitio", "≤ 35 mph", (v) => v <= 35],
    ["corner", "Esquina con semáforo", "Esquina semaforizada", (v) => v],
    ["access", "Accesos", "Al menos 2 accesos", (v) => v >= 2],
    ["visibility", "Visibilidad", "Buena desde todos los ángulos", (v) => v],
    [
      "left",
      "Movimientos de giro",
      "Giro a la izquierda al entrar y salir",
      (v) => v,
    ],
  ]) {
    row(
      key,
      name,
      "Preferido",
      expected,
      d[key] == null ? null : test(d[key]),
      "Confirma este atributo con el agente.",
    );
  }
  rows.push(territoryRow(c, list));
  const required = rows.filter((r) => r.kind === "Obligatorio"),
    fails = required.filter((r) => r.verdict === false),
    missing = required.filter((r) => r.verdict === null);
  const state = fails.length ? "bad" : missing.length ? "pending" : "good";
  return {
    state,
    rows,
    required: required.length,
    passed: required.filter((r) => r.verdict === true).length,
    missing,
    fails,
    prefs: rows.filter((r) => r.kind === "Preferido" && r.verdict === true)
      .length,
    next: fails.length
      ? "Confirma con el agente si se puede corregir: " +
        fails.map((r) => r.name.toLowerCase()).join(", ") +
        "."
      : missing[0]?.ask ||
        (c.availability === "Retirado"
          ? "El anuncio figura retirado. Pregunta al agente si el inmueble volverá al mercado."
          : !c.demo && c.availability !== "Disponible"
            ? "Confirma con el agente que el terreno siga disponible antes de coordinar la visita."
            : statuses.good.action),
  };
}
const common = {
  area: 53500,
  front: 181,
  traffic: 32000,
  drive: true,
  stalls: 60,
  seats: 116,
  speed: 35,
  corner: true,
  access: 2,
  visibility: true,
  left: true,
};
const syntheticBoundary = {
  type: "Polygon",
  coordinates: [
    [
      [-80.348, 25.798],
      [-80.328, 25.798],
      [-80.328, 25.817],
      [-80.348, 25.817],
      [-80.348, 25.798],
    ],
  ],
};
const fixtures = [
  [
    "doral",
    "Parcela en Doral",
    "NW 41st St",
    "Doral",
    "33178",
    25.811,
    -80.366,
    common,
    {
      method: "boundary",
      source: "Plano simulado de prueba",
      date: "2026-11-22",
      complete: true,
      geometry: syntheticBoundary,
    },
  ],
  [
    "hialeah",
    "Esquina en Hialeah",
    "W 49th St",
    "Hialeah",
    "33012",
    25.866,
    -80.299,
    { ...common, area: 48200, front: 163, traffic: 19000, drive: null },
    null,
  ],
  [
    "flagami",
    "Terreno en Flagami",
    "W Flagler St",
    "Miami",
    "33144",
    25.77,
    -80.294,
    { ...common, area: 36100, front: 156, traffic: 22000 },
    null,
  ],
  [
    "kendall",
    "Parcela en Kendall",
    "SW 88th St",
    "Kendall",
    "33176",
    25.686,
    -80.352,
    { ...common, area: 51100, front: null, traffic: null },
    null,
  ],
];
export const demos = fixtures.map(
  ([id, name, address, city, zip, lat, lng, values, territory], i) => ({
    id,
    name,
    address,
    city,
    zip,
    lat,
    lng,
    values,
    territory,
    demo: true,
    number: i + 1,
    availability: "Ejemplo sin oferta comercial",
    sourceType: "Ejemplo simulado",
    date: "2026-11-22",
    operation: "Sin indicar",
  }),
);
export const safeUrl = (s) => {
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
