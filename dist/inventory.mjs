export const county = {
  id: "mdc",
  name: "Miami-Dade County",
  sale: "https://www.miamidade.gov/apps/ISD/RealEstate_Portal/CountyOwnedPropertiesForSale",
  data: "https://opendata.miamidade.gov/datasets/MDC::county-owned-property/about",
  reuse: "https://opendata.miamidade.gov/",
  auctions:
    "https://www.miamidade.gov/global/business/realestate/surplus-real-properties-for-sale.page",
};
export const blankInventory = () => ({ version: 1, records: [], imports: {} });
export const activeRecords = (inventory) =>
  inventory.records.filter((r) => r.status === "listed");
export function mergeBatch(
  before,
  { source, checkedAt, records, listedIds, eligibleIds },
) {
  if (!source || !/^\d{4}-\d\d-\d\d$/.test(checkedAt))
    throw Error("Lote sin fuente o fecha");
  const ids = new Set(records.map((r) => r.sourceId));
  if (
    ids.size !== records.length ||
    records.some(
      (r) =>
        !r.sourceId ||
        !r.address ||
        !r.sourceUrl ||
        !Number.isFinite(r.lat) ||
        Math.abs(r.lat) > 90 ||
        !Number.isFinite(r.lng) ||
        Math.abs(r.lng) > 180 ||
        (r.price != null &&
          (!Number.isFinite(r.price) || r.price < 0 || !r.priceUnit)),
    )
  )
    throw Error("Registro inválido o duplicado");
  if (checkedAt < (before.imports[source] || ""))
    throw Error("Lote anterior a la última actualización");
  const byId = new Map(
    before.records.map((r) => [r.source + ":" + r.sourceId, r]),
  );
  const previous = new Map(byId);
  const delta = { created: 0, updated: 0, unchanged: 0 };
  for (const r of records) {
    if (!["listed", "withdrawn"].includes(r.status))
      throw Error("Estado comercial desconocido");
    const key = source + ":" + r.sourceId;
    byId.set(key, {
      ...r,
      source,
      checkedAt,
      firstSeen: previous.get(key)?.firstSeen || checkedAt,
    });
  }
  if (listedIds) {
    const listed = new Set(listedIds);
    const eligible = new Set(eligibleIds || listedIds);
    for (const [key, r] of previous) {
      if (r.source !== source || ids.has(r.sourceId)) continue;
      const status = !listed.has(r.sourceId)
        ? "withdrawn"
        : eligible.has(r.sourceId)
          ? "outside-sample"
          : "outside-scope";
      byId.set(key, { ...r, status, checkedAt });
    }
  }
  for (const [key, r] of byId) {
    if (r.source !== source) continue;
    const old = previous.get(key);
    if (!old) delta.created++;
    else if (
      JSON.stringify({ ...old, checkedAt: null }) !==
      JSON.stringify({ ...r, checkedAt: null })
    )
      delta.updated++;
    else delta.unchanged++;
  }
  return {
    inventory: {
      version: 1,
      records: [...byId.values()],
      imports: { ...before.imports, [source]: checkedAt },
    },
    delta,
  };
}
export function toCandidate(r, number, reply) {
  const evidence = {
    type: "Catastro de Miami-Dade",
    url: r.propertyCard,
    date: r.checkedAt,
  };
  return {
    id: r.source + ":" + r.sourceId,
    imported: true,
    sourceId: r.sourceId,
    number,
    name: r.address
      .replace(/^Adjacent to:\s*/i, "Junto a ")
      .replace(/^NPA\s+/, "Parcela sin dirección · "),
    address: r.address,
    city: r.city === "UNINCORPORATED" ? "Miami-Dade no incorporado" : r.city,
    zip: r.zip,
    lat: r.lat,
    lng: r.lng,
    operation: r.operation,
    price: r.price,
    priceUnit: r.priceUnit,
    availability:
      r.status === "listed"
        ? "En catálogo de venta · licitación por confirmar"
        : "Fuera del catálogo activo",
    listingDate: r.offerDate,
    date: r.checkedAt,
    listingUrl: r.listingUrl,
    sourceType: county.name,
    sourceUrl: r.sourceUrl,
    propertyCard: r.propertyCard,
    zoning: r.zoningReported,
    brandReply: reply,
    values: {
      totalArea: r.areaTotalSqFt,
      area: r.areaUsableSqFt,
      buildingArea: r.buildingSqFt,
    },
    provenance: {
      buildingArea: evidence,
      totalArea: {
        type: "Inventario GIS de Miami-Dade",
        url: r.sourceUrl,
        date: r.checkedAt,
      },
    },
  };
}
