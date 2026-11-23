import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activeRecords,
  blankInventory,
  mergeBatch,
  toCandidate,
} from "../dist/inventory.mjs";
import { evaluate } from "../dist/model.mjs";
const snapshot = JSON.parse(
  readFileSync(new URL("../dist/data/inventory.json", import.meta.url)),
);
const { source, checkedAt, firstSeen, ...example } = snapshot.records[0];
const batch = (records, options = {}) => ({
  source,
  checkedAt,
  records,
  ...options,
});
test("La importación preserva los folios, actualiza los precios y oculta retirados", () => {
  let state = mergeBatch(blankInventory(), batch([example])).inventory;
  const repeated = mergeBatch(state, batch([example]));
  assert.deepEqual(repeated.inventory, state);
  assert.deepEqual(repeated.delta, { created: 0, updated: 0, unchanged: 1 });
  const edit = { ...example, price: 125000, priceUnit: "USD total" };
  state = mergeBatch(state, batch([edit])).inventory;
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].price, 125000);
  state = mergeBatch(
    state,
    batch([{ ...edit, status: "withdrawn" }]),
  ).inventory;
  assert.equal(activeRecords(state).length, 0);
  assert.equal(state.records[0].sourceId, example.sourceId);
  assert.throws(() => mergeBatch(state, batch([example, example])));
});
test("Una salida de la muestra es distinta de una retirada del catálogo completo", () => {
  const initial = mergeBatch(blankInventory(), batch([example])).inventory;
  const outside = mergeBatch(
    initial,
    batch([], { listedIds: [example.sourceId] }),
  ).inventory;
  assert.equal(outside.records[0].status, "outside-sample");
  assert.equal(activeRecords(outside).length, 0);
  const withdrawn = mergeBatch(initial, batch([], { listedIds: [] })).inventory;
  assert.equal(withdrawn.records[0].status, "withdrawn");
  assert.equal(
    mergeBatch(withdrawn, batch([example])).inventory.records[0].firstSeen,
    checkedAt,
  );
});
test("La superficie total solo puede descartar; ni edificio ni zonificación genérica acreditan compatibilidad", () => {
  const c = toCandidate(
    {
      ...example,
      source,
      checkedAt,
      areaTotalSqFt: 50000,
      areaUsableSqFt: null,
      buildingSqFt: 48000,
      zoningReported: "Ideal para restaurante",
    },
    1,
  );
  const verdict = (c, key) =>
    evaluate(c).rows.find((r) => r.key === key).verdict;
  assert.equal(verdict(c, "area"), null);
  assert.equal(verdict(c, "drive"), null);
  c.values.totalArea = 44999;
  assert.equal(verdict(c, "area"), false);
  assert.equal(evaluate(c).state, "bad");
  c.values.totalArea = 45000;
  assert.equal(verdict(c, "area"), null);
  c.values.area = 45000;
  assert.equal(verdict(c, "area"), true);
});
test("Solo la respuesta documentada sobre esta parcela permite confirmar el territorio importado", () => {
  const c = toCandidate({ ...example, source, checkedAt }, 1);
  const verdict = () =>
    evaluate(c).rows.find((r) => r.key === "territory").verdict;
  assert.equal(verdict(), null);
  c.brandReply = {
    sender: "Marca",
    siteId: "otro",
    source: "https://example.org/mock",
    date: checkedAt,
    text: "Respuesta simulada",
    result: "available",
  };
  assert.equal(verdict(), null);
  c.brandReply.siteId = c.id;
  assert.equal(verdict(), true);
  c.brandReply.result = "inconclusive";
  assert.equal(verdict(), null);
  c.brandReply.result = "unavailable";
  assert.equal(verdict(), false);
  c.brandReply.source = "";
  assert.equal(verdict(), null);
});
test("El inventario publicado conserva identificadores, procedencia, dinero y formas de superficie separados", () => {
  assert.equal(
    snapshot.records.length,
    new Set(snapshot.records.map((r) => r.source + ":" + r.sourceId)).size,
  );
  for (const r of activeRecords(snapshot)) {
    assert.match(r.sourceId, /^\d{13}$/);
    assert.ok(
      r.sourceUrl.startsWith("https://") && r.listingUrl.startsWith("https://"),
    );
    assert.equal(r.areaUsableSqFt, null);
    if (r.areaTotalSqFt < 45000)
      assert.equal(evaluate(toCandidate(r, 1)).state, "bad");
    assert.equal(r.price, null);
  }
});
