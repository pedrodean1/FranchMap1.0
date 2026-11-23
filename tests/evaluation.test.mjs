import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluate,
  demos,
  branches,
  distance,
  inGeometry,
  validShape,
} from "../dist/model.mjs";
const [compatible, partial, discarded] = demos;
const box = (x, y, delta) => ({
  type: "Polygon",
  coordinates: [
    [
      [x - delta, y - delta],
      [x + delta, y - delta],
      [x + delta, y + delta],
      [x - delta, y + delta],
      [x - delta, y - delta],
    ],
  ],
});
const documented = {
  source: "https://example.org/simulated-territory",
  date: "2026-11-22",
  complete: true,
};
test("Compatible con evidencia completa y polígono ficticio identificado", () => {
  assert.equal(compatible.demo, true);
  assert.equal(evaluate(compatible).state, "good");
});
test("Descartado tiene precedencia sobre territorio desconocido", () => {
  const result = evaluate(discarded);
  assert.equal(result.state, "bad");
  assert.ok(result.missing.length);
  assert.equal(result.fails[0].key, "area");
});
test("La falta de documentación territorial deja pendiente un inmueble que cumple todo lo demás", () => {
  assert.equal(evaluate({ ...compatible, territory: null }).state, "pending");
  assert.equal(evaluate(partial).state, "pending");
});
test("La sucursal determinante puede estar fuera de la zona de búsqueda", () => {
  const c = {
    ...compatible,
    territory: { ...documented, method: "straight", minKm: 3 },
    lat: 26.039,
    lng: -80.255,
  };
  const area = box(c.lng, c.lat, 0.001);
  const unrelated = {
    name: "Sucursal distante simulada",
    lng: -80.5,
    lat: 26.1,
  };
  assert.equal(inGeometry([c.lng, c.lat], area), true);
  assert.equal(inGeometry([branches[0].lng, branches[0].lat], area), false);
  assert.equal(evaluate(c, [unrelated]).state, "good");
  const result = evaluate(c, [unrelated, ...branches]);
  assert.equal(result.state, "bad");
  assert.equal(result.fails[0].branch.name, "Cooper City");
});
test("Con cobertura parcial, una distancia suficiente no demuestra cumplimiento", () => {
  const c = {
    ...compatible,
    territory: { ...documented, method: "straight", minKm: 1, complete: false },
  };
  assert.equal(evaluate(c).state, "pending");
  assert.equal(evaluate(c, []).state, "pending");
});
test("La distancia por carretera necesita ruta documentada a cada sucursal", () => {
  const c = {
    ...compatible,
    territory: { ...documented, method: "road", minKm: 2, routes: [] },
  };
  assert.equal(evaluate(c).state, "pending");
  c.territory.routes = branches.map((b) => ({
    name: b.name,
    km: 4,
    source: "https://example.org/test-route",
  }));
  assert.equal(evaluate(c).state, "good");
  c.territory.routes[1].km = 1.5;
  assert.equal(evaluate(c).state, "bad");
});
test("Mínimos inclusivos, estacionamiento impar y preferencias independientes", () => {
  const v = {
    ...compatible.values,
    area: 45000,
    front: 150,
    traffic: 15000,
    stalls: 51,
    seats: 101,
    speed: 45,
    corner: false,
  };
  assert.equal(evaluate({ ...compatible, values: v }).state, "good");
  assert.equal(
    evaluate({ ...compatible, values: { ...v, stalls: 50 } }).state,
    "bad",
  );
});
test("El plano no se aplica a inmuebles reales sin referencia documental", () => {
  assert.equal(evaluate({ ...compatible, demo: false }).state, "pending");
  assert.equal(
    evaluate({
      ...compatible,
      territory: {
        ...compatible.territory,
        geometry: box(compatible.lng, compatible.lat, 0.001),
      },
    }).state,
    "bad",
  );
});
test("Coordenadas, huecos y límites de área", () => {
  const ring = box(0, 0, 2);
  ring.coordinates.push(box(0, 0, 0.5).coordinates[0]);
  assert.ok(validShape(ring));
  assert.ok(!inGeometry([0, 0], ring));
  assert.ok(inGeometry([1, 1], ring));
  assert.ok(!validShape({ type: "Polygon", coordinates: [] }));
  assert.equal(distance(compatible, compatible), 0);
});
test("La cobertura cartográfica incluye los ejemplos y permite filtrar por Doral y su ZIP", () => {
  const source = (file) =>
    JSON.parse(
      readFileSync(
        new URL("../dist/data/" + file + ".geojson", import.meta.url),
      ),
    ).features;
  const zones = source("zones"),
    counties = source("counties");
  assert.ok(
    demos.every((c) =>
      counties.some((f) => inGeometry([c.lng, c.lat], f.geometry)),
    ),
  );
  for (const k of ["Doral", "33178"]) {
    const f = zones.find((z) => z.properties.name === k);
    assert.ok(f);
    assert.ok(inGeometry([compatible.lng, compatible.lat], f.geometry), k);
  }
  assert.ok(
    branches.every((b) =>
      counties.some((f) => inGeometry([b.lng, b.lat], f.geometry)),
    ),
  );
});
