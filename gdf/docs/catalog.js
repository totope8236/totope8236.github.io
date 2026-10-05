/*
 * GDF document catalog
 * --------------------
 * One entry per PDF in this "docs" folder. To add a document:
 *   1. Drop the PDF into gdf/docs/
 *   2. Add an entry below (or run:  python3 tools/update_catalog.py  to add a stub automatically)
 *
 * Fields
 *   file   (required) file name inside docs/
 *   title  (required) name shown in the table
 *   code   form number(s), e.g. "DT9003 · AH-515" (searchable)
 *   tags   list of keywords / synonyms / abbreviations (searchable, partial matches)
 *   stamp  (optional) where the patient label goes, see js/stamp.js. Without it, the label goes in the
 *          identification box of the Québec (MSSS) forms, on every page.
 *          e.g. { pages: [1], box: { x: 342, y: 42, w: 228, h: 120 } }   (points, from the top-left corner)
 *
 * This is a .js file (not .json) so the site also loads when index.html is opened directly from disk.
 */

// Where the addressograph label goes on MUHC forms (points from the top-left corner of the page).
// MUHC order sheet DM-6225: blank area to the right of the logo and barcode, right edge aligned with the
// orders table. The box is as wide as the label, so the text is printed at full width.
const MUHC_ORDERS_LABEL = { box: { x: 352.6, y: 44.4, w: 242.4, h: 80 } };
// MUHC consultation DM-3451: top-right corner, above the title.
const MUHC_CONSULT_LABEL = { pages: [1], box: { x: 356.6, y: 15, w: 242.4, h: 76 } };

const MUHC = ["CUSM", "MUHC", "McGill", "RVH", "MGH", "HRV", "HGM", "Glen"];
const ORDERS = ["ordonnance", "ordonnances", "ordonnances médicales", "orders", "order set", "pré-imprimée",
  "preprinted", "pharmaceutical orders", "ordonnances pharmaceutiques", "OPI", "DM-6225"];

window.GDF_CATALOG = [
  // ---------- Québec (MSSS) forms ----------
  {
    file: "demande_electrophysiologie_dt9003.pdf",
    title: "Demande de service – Électrophysiologie",
    code: "DT9003 · AH-515",
    tags: [
      "électrophysiologie", "EP", "EPS", "étude électrophysiologique", "ablation",
      "stimulateur cardiaque", "pacemaker", "PM", "défibrillateur", "DCI", "ICD",
      "CRT", "resynchronisation", "Holter implantable", "ILR", "cardioversion",
      "demande de service", "consultation", "requête", "arythmie", "FA", "flutter",
    ],
  },
  {
    file: "demande_hemodynamie_dt9002.pdf",
    title: "Demande de service – Hémodynamie (adulte)",
    code: "DT9002 · AH-514",
    tags: [
      "hémodynamie", "coronarographie", "coro", "cathétérisme", "cath", "angiographie",
      "angioplastie", "ICP", "PCI", "cathé droit", "RHC", "SCA", "NSTEMI", "angine",
      "demande de service", "consultation", "requête", "transfert",
    ],
  },
  {
    file: "niveau_soins_dt9261.pdf",
    title: "Niveaux de soins et réanimation cardiorespiratoire",
    code: "DT9261 · AH-744",
    tags: [
      "niveau de soins", "NIM", "niveau d'intervention médicale", "RCR", "réanimation",
      "code", "DNR", "DNAR", "no code", "goals of care", "GOC", "level of care",
      "intubation", "objectifs de soins", "INESSS",
    ],
  },

  // ---------- MUHC / CUSM forms ----------
  {
    file: "consultation_medicale_dm3451.pdf",
    title: "Consultation médicale / Medical consultation",
    code: "DM-3451",
    stamp: MUHC_CONSULT_LABEL,
    tags: [
      ...MUHC, "consultation", "consult", "demande de consultation", "consultation request",
      "médecin consultant", "consultant", "référence", "referral", "consultation pré-op", "pre-op",
      "prise en charge", "transfer", "soins simultanés", "DM-3451",
    ],
  },
  {
    file: "ordonnances_medicales_dm6225.pdf",
    title: "Ordonnances médicales (feuille vierge) / Medical orders (blank)",
    code: "DM-6225",
    stamp: MUHC_ORDERS_LABEL,
    tags: [...MUHC, ...ORDERS, "vierge", "blank", "feuille d'ordonnances", "prescription", "Rx", "orders sheet"],
  },
  {
    file: "ordo_analgesia_sedation_icu.pdf",
    title: "Pharmaceutical orders – Analgesia and sedation – Adult ICU",
    code: "DM-6225",
    stamp: MUHC_ORDERS_LABEL,
    tags: [
      ...MUHC, ...ORDERS, "analgésie", "analgesia", "sédation", "sedation", "soins intensifs", "SI", "USI",
      "ICU", "intensive care", "ventilation", "intubé", "intubated", "CPOT", "RASS", "morphine",
      "hydromorphone", "Dilaudid", "fentanyl", "midazolam", "Versed", "propofol", "famotidine", "PPI",
      "IPP", "pantoprazole", "ulcère de stress", "stress ulcer prophylaxis", "chlorhexidine", "VAP", "PAV",
      "perfusion", "infusion",
    ],
  },
  {
    file: "ordo_comfort_care.pdf",
    title: "Pharmaceutical orders – Comfort care – Adult",
    code: "DM-6225",
    stamp: MUHC_ORDERS_LABEL,
    tags: [
      ...MUHC, ...ORDERS, "soins de confort", "comfort care", "soins palliatifs", "palliative", "fin de vie",
      "end of life", "SPFV", "morphine", "hydromorphone", "haloperidol", "Haldol", "lorazepam", "Ativan",
      "methotrimeprazine", "Nozinan", "ondansetron", "dimenhydrinate", "Gravol", "polyethylene glycol",
      "Lax-A-Day", "PEG", "dyspnée", "dyspnea", "douleur", "pain", "nausée", "agitation", "constipation",
      "équianalgésie", "pharmacokinetic",
    ],
  },
  {
    file: "ordo_contrast_allergy_premedication.pdf",
    title: "Contrast media allergy premedication (iodinated / gadolinium)",
    code: "DM-6225",
    stamp: MUHC_ORDERS_LABEL,
    tags: [
      ...MUHC, ...ORDERS, "allergie", "allergy", "produit de contraste", "contrast", "iode", "iodinated",
      "gadolinium", "prémédication", "premedication", "prednisone", "methylprednisolone", "Solu-Medrol",
      "diphenhydramine", "Benadryl", "CT", "scan", "TDM", "IRM", "MRI", "coronarographie", "coro",
      "anaphylaxie", "anaphylaxis",
    ],
  },
  {
    file: "ordo_contrast_nephropathy_prevention.pdf",
    title: "Prevention of iodinated contrast-induced nephropathy – Inpatient and emergency",
    code: "DM-6225",
    stamp: MUHC_ORDERS_LABEL,
    tags: [
      ...MUHC, ...ORDERS, "néphropathie", "nephropathy", "néphrotoxicité", "CIN", "CI-AKI", "IRA", "AKI",
      "insuffisance rénale", "eGFR", "DFGe", "créatinine", "creatinine", "hydratation", "hydration",
      "NaCl", "salin", "saline", "metformine", "metformin", "furosémide", "diurétiques", "produit de contraste",
      "contrast", "iode", "iodinated", "CT", "TDM", "coronarographie", "coro", "urgence", "emergency",
    ],
  },
  {
    file: "ordo_distress_bronchial_congestion_palliative.pdf",
    title: "Pharmaceutical orders – Distress and bronchial congestion – Palliative care adult",
    code: "DM-6225",
    stamp: { ...MUHC_ORDERS_LABEL, pages: [1] }, // page 2 is a dose table with no room for the label
    tags: [
      ...MUHC, ...ORDERS, "détresse", "distress", "protocole de détresse", "distress order", "congestion",
      "bronchial congestion", "râles", "secretions", "sécrétions", "soins palliatifs", "palliative", "fin de vie",
      "end of life", "SPFV", "midazolam", "Versed", "morphine", "hydromorphone", "fentanyl", "scopolamine",
      "glycopyrrolate", "Robinul", "hémorragie", "hemorrhage",
    ],
  },
  {
    file: "ordo_shivering_control_ttm.pdf",
    title: "Pharmaceutical orders – Shivering control – Targeted temperature management",
    code: "DM-6225",
    stamp: MUHC_ORDERS_LABEL,
    tags: [
      ...MUHC, ...ORDERS, "frissons", "shivering", "hypothermie", "hypothermia", "TTM", "contrôle ciblé de la température",
      "targeted temperature management", "arrêt cardiaque", "cardiac arrest", "post-arrêt", "post ROSC", "BSAS",
      "acetaminophen", "magnésium", "magnesium", "mépéridine", "meperidine", "Demerol", "rocuronium",
      "cisatracurium", "curare", "bloqueur neuromusculaire", "neuromuscular blockade", "soins intensifs", "ICU",
    ],
  },
  {
    file: "ordo_vasopressors_inotropes_chronotropes.pdf",
    title: "Vasopressors / Inotropes / Chronotropes – Adult",
    code: "DM-6225",
    stamp: MUHC_ORDERS_LABEL,
    tags: [
      ...MUHC, ...ORDERS, "vasopresseurs", "vasopressors", "pressors", "amines", "inotropes",
      "chronotropes", "choc", "shock", "choc cardiogénique", "cardiogenic shock", "norépinéphrine",
      "norepinephrine", "Levophed", "levo", "épinéphrine", "epinephrine", "adrénaline", "vasopressine",
      "vasopressin", "dopamine", "dobutamine", "milrinone", "isoprotérénol", "isoproterenol", "Isuprel",
      "TAM", "MAP", "PAS", "SBP", "perfusion", "infusion", "soins intensifs", "unité coronarienne", "CCU", "USIC",
    ],
  },
];
