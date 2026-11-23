import { readFile, writeFile, rename, open, rm } from "node:fs/promises";
import { parseArgs, promisify } from "node:util";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { county, blankInventory, mergeBatch } from "../dist/inventory.mjs";
const run = promisify(execFile);
const args = parseArgs({ options: { output: { type: "string" } } }).values;
const target = resolve(
  args.output ||
    fileURLToPath(new URL("../dist/data/inventory.json", import.meta.url)),
);
const sourceRoot =
  "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/";
const fields =
  "FOLIO,ADDRESS,CITY,ZIPCODE,LOTSIZE,PROPTYPE,UTILSTATUS,UTILSTDESC,ZONING";
const asUrl = (url, params) => url + "?" + new URLSearchParams(params);
const gis = (layer, params) =>
  asUrl(sourceRoot + layer + "/FeatureServer/0/query", {
    f: "json",
    ...params,
  });
async function get(url) {
  const { stdout } = await run(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "35",
      "--retry",
      "2",
      url,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  return stdout;
}
async function features(url) {
  const raw = JSON.parse(await get(url));
  if (!Array.isArray(raw.features) || raw.error || raw.exceededTransferLimit)
    throw Error("Respuesta GIS incompleta");
  return raw.features;
}
async function salePage(pageIndex) {
  const html = await get(
    asUrl(county.sale, { sortOrder: "lot_desc", pageIndex }),
  );
  const counts = html.match(/Showing\s+(\d+)\s*-\s*(\d+)\s*\((\d+)\)/i);
  if (!counts)
    throw Error("No se pudo verificar la paginación del catálogo de venta");
  const ids = [
    ...html.matchAll(/propertysearch\/[^'"]*?[?&]folio=(\d{13})/gi),
  ].map((m) => m[1]);
  if (ids.length !== Number(counts[2]) - Number(counts[1]) + 1)
    throw Error("Página de venta incompleta");
  return { ids, total: Number(counts[3]), pageIndex };
}
async function countySales() {
  const first = await salePage(1);
  const pages = await Promise.all(
    Array.from(
      { length: Math.ceil(first.total / first.ids.length) - 1 },
      (_, i) => salePage(i + 2),
    ),
  );
  const ids = [...first.ids, ...pages.flatMap((p) => p.ids)];
  if (
    pages.some((p) => p.total !== first.total) ||
    new Set(ids).size !== first.total ||
    ids.length !== first.total
  )
    throw Error("El catálogo cambió durante la consulta");
  return new Map(
    [first, ...pages].flatMap((page) =>
      page.ids.map((id) => [id, page.pageIndex]),
    ),
  );
}
async function importCounty() {
  const [salePages, raw] = await Promise.all([
    countySales(),
    features(
      gis("MDCOwnProperty_gdb", {
        where: "UTILSTATUS='Surplus' AND PROPTYPE='Vacant Land'",
        outFields: fields,
        returnGeometry: "true",
        outSR: "4326",
        resultRecordCount: "2000",
      }),
    ),
  ]);
  const listedIds = [...salePages.keys()];
  const listed = salePages;
  const eligible = raw
    .filter((f) => listed.has(f.attributes.FOLIO))
    .sort(
      (a, b) =>
        b.attributes.LOTSIZE - a.attributes.LOTSIZE ||
        a.attributes.FOLIO.localeCompare(b.attributes.FOLIO),
    );
  const sample = eligible.slice(0, 8);
  const appraisals = sample.length
    ? await features(
        gis("PaParcelView_gdb", {
          where:
            "FOLIO IN (" +
            sample.map((f) => "'" + f.attributes.FOLIO + "'").join(",") +
            ")",
          outFields: "FOLIO,LOT_SIZE,BUILDING_ACTUAL_AREA",
          returnGeometry: "false",
        }),
      )
    : [];
  const parcels = new Map(
    appraisals.map((f) => [f.attributes.FOLIO, f.attributes]),
  );
  const records = sample.map(({ attributes: a, geometry: g }) => {
    const id = a.FOLIO,
      parcel = parcels.get(id);
    if (
      !/^\d{13}$/.test(id) ||
      !g ||
      !Number.isFinite(a.LOTSIZE) ||
      a.LOTSIZE < 0 ||
      (parcel?.LOT_SIZE != null && Math.abs(parcel.LOT_SIZE - a.LOTSIZE) > 1)
    )
      throw Error("Revisar medidas o folio: " + id);
    return {
      sourceId: id,
      address: a.ADDRESS,
      city: a.CITY,
      zip: a.ZIPCODE,
      lat: g.y,
      lng: g.x,
      operation: "Venta",
      price: null,
      priceUnit: null,
      areaTotalSqFt: a.LOTSIZE,
      areaUsableSqFt: null,
      buildingSqFt: parcel?.BUILDING_ACTUAL_AREA ?? null,
      zoningReported: a.ZONING,
      offerDate: null,
      status: "listed",
      reportedAvailability: a.UTILSTATUS,
      sourceUrl: gis("MDCOwnProperty_gdb", {
        where: "FOLIO='" + id + "'",
        outFields: fields,
        outSR: "4326",
        f: "pjson",
      }),
      listingUrl: asUrl(county.sale, {
        sortOrder: "lot_desc",
        pageIndex: salePages.get(id),
      }),
      propertyCard:
        "https://apps.miamidadepa.gov/propertysearch/#/?folio=" + id,
    };
  });
  const checkedAt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return {
    source: county.id,
    checkedAt,
    records,
    listedIds,
    eligibleIds: eligible.map((f) => f.attributes.FOLIO),
  };
}
const lock = target + ".lock";
const handle = await open(lock, "wx");
try {
  let original;
  try {
    original = JSON.parse(await readFile(target, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    original = blankInventory();
  }
  const { inventory, delta } = mergeBatch(original, await importCounty());
  await writeFile(target + ".tmp", JSON.stringify(inventory, null, 2) + "\n");
  await rename(target + ".tmp", target);
  console.log(
    JSON.stringify({
      listed: inventory.records.filter((r) => r.status === "listed").length,
      ...delta,
    }),
  );
} finally {
  await handle.close();
  await rm(lock);
}
