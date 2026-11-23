import { esc } from "./maps.mjs";
import { profile, evaluate } from "./model.mjs";
export const contact = {
  name: "Christie Hughes",
  email: "christiehughes@culvers.com",
};
export function inquiryContent(c) {
  const siteES = c
    ? c.address + " (folio " + c.sourceId + ")"
    : "[dirección y folio]";
  const siteEN = c
    ? c.address + " (folio " + c.sourceId + ")"
    : "[address and parcel ID]";
  const label = c
    ? "Borrador para esta parcela"
    : "Plantilla para el próximo terreno que merezca consulta";
  const es =
    "Estimada Sra. Hughes:\n\nEstamos evaluando " +
    siteES +
    " en Miami-Dade. ¿Está esta parcela dentro de un territorio disponible para un nuevo franquiciado? ¿Consideraría Culver’s este terreno para un restaurante independiente con drive-thru? Podemos facilitar el plano y la documentación que su equipo necesite.\n\nGracias,\nPedro Dean";
  const en =
    "Dear Ms. Hughes,\n\nWe are reviewing " +
    siteEN +
    " in Miami-Dade County. Is this parcel in a territory available to a new franchisee? Would Culver’s consider it for a freestanding restaurant with a drive-thru? We can provide a site plan and any supporting documents your team needs.\n\nThank you,\nPedro Dean";
  return (
    "<h3>" +
    label +
    "</h3><p><strong>Destinataria</strong> · " +
    contact.name +
    " · " +
    contact.email +
    ' · <a href="' +
    profile.realEstate +
    '" target="_blank" rel="noopener">Contacto oficial de Culver’s</a></p><p class="minor">Borrador pendiente de tu aprobación.</p>' +
    [
      [
        "Español",
        "Consulta sobre territorio y terreno en Miami-Dade · " + siteES,
        es,
      ],
      ["English", "Miami-Dade territory and site inquiry · " + siteEN, en],
    ]
      .map(
        ([lang, subject, message]) =>
          '<section class="email-copy"><strong>' +
          lang +
          "</strong><p>Asunto · " +
          esc(subject) +
          "</p><p>" +
          esc(message).replaceAll("\n", "<br>") +
          "</p></section>",
      )
      .join("")
  );
}
export function shortlist(cs) {
  return cs
    .map((c) => ({ c, e: evaluate(c) }))
    .filter(
      ({ c, e }) =>
        e.state !== "bad" &&
        (c.values.area >= 45000 || c.values.totalArea >= 45000),
    )
    .sort(
      (a, b) =>
        (b.c.date || "").localeCompare(a.c.date || "") ||
        a.e.missing.length - b.e.missing.length ||
        b.e.prefs - a.e.prefs,
    )
    .slice(0, 2);
}
