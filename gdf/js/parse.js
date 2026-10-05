/*
 * Parse the patient banner copied from the hospital system, e.g.
 *
 *   MR0342739 DDN/DOB: 1951-06-25 (75 y) F DECARIE, DIANE NAM/RAMQ: DECD51562510 Exp.: 2026/05
 *   302-6245 JOGUES MONTREAL, PQ H4E 4J2 Admission-Visite/Visit: 2026-09-24 21:40 Site: RVH
 *   Emplacement/Location: C07S-31-A
 *
 * parsePatient(text) → { fields: {mrn, dob, sex, lastName, firstName, ramq, ramqExp, address, city,
 * province, postalCode, site}, missing: [labels of what wasn't found] }
 * Only fields that were found are returned.
 */
(function () {
  "use strict";

  // Cities whose name contains a SPACE (most Québec names use hyphens, which need nothing special).
  // The banner doesn't separate the street from the city, so the city is taken to be the last word,
  // or one of these when the address ends with it.
  const MULTI_WORD_CITIES = [
    "DOLLARD-DES ORMEAUX", "DOLLARD DES ORMEAUX", "VILLE MONT-ROYAL", "VILLE MONT ROYAL", "MONT ROYAL",
    "VILLE SAINT-LAURENT", "VILLE ST-LAURENT", "VILLE LASALLE", "VILLE D'ANJOU", "VILLE-MARIE",
    "SAINTE ANNE DE BELLEVUE", "ST ANNE DE BELLEVUE", "POINTE CLAIRE", "BAIE D'URFE", "ILE PERROT",
    "NOTRE DAME DE L'ILE PERROT", "SAINT LAURENT", "ST LAURENT", "SAINT LEONARD", "ST LEONARD",
    "SAINT LAZARE", "ST LAZARE", "SAINT JEAN SUR RICHELIEU", "ST JEAN SUR RICHELIEU", "SAINT JEROME",
    "ST JEROME", "SAINT EUSTACHE", "ST EUSTACHE", "SAINT CONSTANT", "ST CONSTANT", "SAINT HUBERT",
    "ST HUBERT", "SAINT LAMBERT", "ST LAMBERT", "SAINT BRUNO", "ST BRUNO", "SAINTE JULIE", "STE JULIE",
    "SAINTE CATHERINE", "STE CATHERINE", "SAINT HYACINTHE", "ST HYACINTHE", "TROIS RIVIERES",
    "SALABERRY DE VALLEYFIELD", "VAUDREUIL DORION", "L'ILE BIZARD", "ILE BIZARD", "LA PRAIRIE",
    "LE GARDEUR", "DEUX MONTAGNES", "MONTREAL NORD", "MONTREAL EST", "MONTREAL OUEST",
    "MONTREAL WEST", "MONTREAL EAST", "MONTREAL NORTH", "COTE SAINT-LUC", "COTE ST-LUC", "COTE ST LUC",
    "HAMPSTEAD", "LAVAL DES RAPIDES", "ROUYN NORANDA", "VAL D'OR", "SEPT ILES", "BAIE COMEAU",
    "OTTAWA", "GATINEAU",
  ].map((c) => c.toUpperCase()).sort((a, b) => b.length - a.length);

  const PROVINCES = { PQ: "QUE", QC: "QUE", QUE: "QUE", QUEBEC: "QUE" };

  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

  function splitStreetCity(s) {
    s = clean(s);
    const up = plain(s);
    for (const c of MULTI_WORD_CITIES) {
      if (up.endsWith(" " + c) && up.length > c.length + 1) {
        return { address: clean(s.slice(0, s.length - c.length)), city: clean(s.slice(s.length - c.length)) };
      }
    }
    const i = s.lastIndexOf(" ");
    return i > 0 ? { address: s.slice(0, i), city: s.slice(i + 1) } : { address: "", city: s };
  }

  function parsePatient(text) {
    const t = clean(text);
    const f = {};
    let m;

    if ((m = t.match(/^MR\s*([A-Z0-9]+)/i) || t.match(/\bMR\s*([0-9][A-Z0-9]*)/i))) f.mrn = m[1].toUpperCase();
    if ((m = t.match(/DDN\s*\/\s*DOB\s*:?\s*(\d{4})[-\/](\d{2})[-\/](\d{2})/i))) f.dob = `${m[1]}-${m[2]}-${m[3]}`;

    // after the DOB: "(75 y) F DECARIE, DIANE NAM/RAMQ:"
    if ((m = t.match(/DDN\s*\/\s*DOB\s*:?\s*\S+\s*(?:\([^)]*\))?\s*([MFXU])\s+(.*?)\s*(?:NAM\s*\/\s*RAMQ|$)/i))) {
      f.sex = m[1].toUpperCase() === "U" ? "" : m[1].toUpperCase();
      const name = clean(m[2]);
      const comma = name.indexOf(",");
      if (comma >= 0) {
        f.lastName = clean(name.slice(0, comma));
        f.firstName = clean(name.slice(comma + 1));
      } else if (name) {
        f.lastName = name;
      }
      if (!f.sex) delete f.sex;
    }

    if ((m = t.match(/NAM\s*\/\s*RAMQ\s*:?\s*([A-Z]{4}\s?\d{4}\s?\d{4})/i))) {
      const r = m[1].replace(/\s/g, "").toUpperCase();
      f.ramq = `${r.slice(0, 4)} ${r.slice(4, 8)} ${r.slice(8)}`;
    }
    if ((m = t.match(/Exp\.?\s*:?\s*(\d{4})\s*[\/-]\s*(\d{1,2})/i))) f.ramqExp = `${m[1]}-${m[2].padStart(2, "0")}`;

    // address: between the RAMQ expiry (or RAMQ, or name) and "Admission"/"Site:"
    let addr = null;
    const afterRamq = /NAM\s*\/\s*RAMQ\s*:?\s*(?:[A-Z]{4}\s?\d{4}\s?\d{4})?\s*(?:Exp\.?\s*:?\s*(?:\d{4}\s*[\/-]\s*\d{1,2})?)?\s*(.*?)\s*(?:Admission|Site\s*:|Emplacement|$)/i;
    if ((m = t.match(afterRamq))) addr = m[1];
    if (addr) {
      addr = clean(addr);
      if ((m = addr.match(/\s*([A-Z]\d[A-Z])\s?(\d[A-Z]\d)$/i))) {
        f.postalCode = `${m[1]} ${m[2]}`.toUpperCase();
        addr = addr.slice(0, m.index);
      }
      if ((m = addr.match(/,\s*([A-Z]{2,3}|QUEBEC)\s*$/i))) {
        const p = m[1].toUpperCase();
        f.province = PROVINCES[p] || p;
        addr = addr.slice(0, m.index);
      }
      const sc = splitStreetCity(addr.replace(/,\s*$/, ""));
      if (sc.address) f.address = sc.address;
      if (sc.city) f.city = sc.city;
    }

    if ((m = t.match(/\bSite\s*:?\s*([A-Z]{2,4})\b/i))) f.site = m[1].toUpperCase();

    const labels = { mrn: "MRN", dob: "date of birth", sex: "sex", lastName: "name", ramq: "RAMQ", ramqExp: "RAMQ expiry",
      address: "address", city: "city", postalCode: "postal code", site: "site" };
    const missing = Object.keys(labels).filter((k) => !f[k]).map((k) => labels[k]);
    return { fields: f, missing };
  }

  /** Does this text look like a patient banner? (used to catch a paste anywhere on the page) */
  const looksLikeBanner = (text) => /\bMR\s*[A-Z0-9]+/i.test(text) && /DDN\s*\/\s*DOB/i.test(text);

  const api = { parsePatient, looksLikeBanner };
  if (typeof window !== "undefined") window.GDFParse = api;
  if (typeof module !== "undefined") module.exports = api;
})();
