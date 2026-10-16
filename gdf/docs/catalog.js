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
 * Every PDF has an even number of pages so it prints double-sided: the backs that were added are blank
 * (or a reference page), so each entry lists the pages that get the label in stamp.pages.
 *
 * This is a .js file (not .json) so the site also loads when index.html is opened directly from disk.
 */

// Where the addressograph label goes on MUHC forms (points from the top-left corner of the page).
// The label itself is ≈239 pt wide from the box's left edge (3 pt padding + 236 pt of text), so a box
// at x = R − 239.4 puts the label's right edge at R.
//
// MUHC order sheet DM-6225: blank area to the right of the logo and barcode, right edge aligned with the
// orders table (592 pt). The box is as wide as the label, so the text is printed at full width.
const MUHC_ORDERS_LABEL = { box: { x: 352.6, y: 44.4, w: 242.4, h: 80 } };
// MUHC consultation DM-3451: top-right corner, above the title.
const MUHC_CONSULT_LABEL = { pages: [1], box: { x: 356.6, y: 15, w: 242.4, h: 76 } };

const MUHC = ["CUSM", "MUHC", "McGill", "RVH", "MGH", "HRV", "HGM", "Glen"];
const PREPRINTED = ["ordonnance", "ordonnances", "ordonnances médicales", "orders", "order set", "pré-imprimée",
  "preprinted", "OPI"];
const ORDERS = [...PREPRINTED, "pharmaceutical orders", "ordonnances pharmaceutiques", "DM-6225"];

window.GDF_CATALOG = [
  // ---------- Québec (MSSS) forms ----------
  {
    file: "demande_electrophysiologie_dt9003.pdf",
    title: "Demande de service – Électrophysiologie",
    code: "DT9003 · AH-515",
    stamp: { pages: [1] }, // page 2 only has a small "Nom / N° de dossier" strip, no room for the label
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
    stamp: { pages: [1] }, // page 2 is the CCS / priority reference table, no identification box
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
    stamp: { pages: [1] }, // page 2 is "Notes explicatives", no identification box
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
    stamp: MUHC_CONSULT_LABEL, // page 2 is blank
    tags: [
      ...MUHC, "consultation", "consult", "demande de consultation", "consultation request",
      "médecin consultant", "consultant", "référence", "referral", "consultation pré-op", "pre-op",
      "prise en charge", "transfer", "soins simultanés", "DM-3451",
    ],
  },
  {
    file: "DM-1800_Nutrition_Consult_fillable.pdf",
    title: "Rapport de consultation en nutrition / Nutrition consult report",
    code: "DM-1800",
    // above the "Numéro de dossier / Unit Number / Nom du patient" caption, right edge aligned with it; page 2 is blank
    stamp: { pages: [1], box: { x: 349, y: 64, w: 242.4, h: 80 } },
    tags: [
      ...MUHC, "nutrition", "nutritionniste", "nutritionist", "diététiste", "dietitian", "diététique",
      "consultation", "consult", "référence", "referral", "alimentation", "dénutrition", "malnutrition",
      "gavage", "tube feeding", "TPN", "NPT", "Service de nutrition clinique", "DM-1800",
    ],
  },
  {
    file: "DM-2811_Cath_Consent_fillable.pdf",
    title: "Consentement – Cathétérisme cardiaque et angiographie / Cardiac catheterization consent",
    code: "DM-2811",
    // page 1 = French, page 2 = English, both with the full header; right edge aligned with the text (566 pt)
    stamp: { pages: [1, 2], box: { x: 327, y: 66, w: 242.4, h: 80 } },
    tags: [
      ...MUHC, "consentement", "consent", "cathétérisme", "cath", "cath lab", "laboratoire de cathétérisme",
      "hémodynamie", "coronarographie", "coro", "angiographie", "angiography", "angioplastie", "angioplasty",
      "ICP", "PCI", "pontage", "bypass", "risques", "risks", "DM-2811",
    ],
  },
  {
    file: "Post-CCU_Discharge_Referral_fillable.pdf",
    title: "NP Rapid Access Cardiology Clinic referral (post-CCU discharge)",
    code: "",
    // right edge aligned with the form's text (566 pt); page 2 is blank
    stamp: { pages: [1], box: { x: 327, y: 44.4, w: 242.4, h: 80 } },
    tags: [
      ...MUHC, "référence", "referral", "congé", "discharge", "post-USIC", "post-CCU", "USIC", "CCU",
      "unité coronarienne", "clinique d'accès rapide", "rapid access", "RAC", "IPS", "NP", "nurse practitioner",
      "suivi", "follow-up", "cardiologie", "cardiology", "clinique externe", "outpatient", "TAVI", "SCA", "ACS",
      "NSTEMI", "STEMI", "FA", "anticoagulation", "INR", "péricardite", "myocardite", "cardiotx",
    ],
  },
  {
    file: "ordonnances_medicales_dm6225.pdf",
    title: "Ordonnances médicales (feuille vierge) / Medical orders (blank)",
    code: "DM-6225",
    stamp: MUHC_ORDERS_LABEL, // single page: every page gets the label
    tags: [...MUHC, ...ORDERS, "vierge", "blank", "feuille d'ordonnances", "prescription", "Rx", "orders sheet"],
  },
  {
    file: "DM-1541_Major_Distress_End_of_Life_fillable.pdf",
    title: "Ordonnance – Détresse majeure en fin de vie / Major distress at the end of life order",
    code: "DM-1541",
    stamp: { ...MUHC_ORDERS_LABEL, pages: [1] }, // page 2 is the algorithm, no room for the label
    tags: [
      ...MUHC, ...PREPRINTED, "détresse", "détresse majeure", "major distress", "distress", "protocole de détresse",
      "distress order", "fin de vie", "end of life", "soins palliatifs", "palliative", "SPFV", "dyspnée terminale",
      "terminal dyspnea", "hémorragie", "hemorrhage", "midazolam", "Versed", "morphine", "hydromorphone",
      "Dilaudid", "sous-cutané", "SC", "algorithme", "algorithm", "DM-1541",
    ],
  },
  {
    file: "DM-1562_Insulin_Sliding_Scale_fillable.pdf",
    title: "Ordonnance d'insuline sous-cutanée – Dose de base et échelle de correction / Subcutaneous insulin orders",
    code: "DM-1562",
    // right edge aligned with the orders table (583 pt); page 2 is the insulin / hypoglycemia reference page
    stamp: { pages: [1], box: { x: 344, y: 44.4, w: 242.4, h: 80 } },
    tags: [
      ...MUHC, ...PREPRINTED, "insuline", "insulin", "échelle", "sliding scale", "échelle de correction",
      "correction scale", "dose de base", "baseline", "basal", "bolus", "diabète", "diabetes", "DB", "DM1", "DM2",
      "glycémie", "glucose", "CBG", "glycémie capillaire", "hypoglycémie", "hypoglycemia", "Lantus", "Levemir",
      "Humalog", "Novorapid", "NPH", "Humulin", "Toronto", "DM-1562", "DM-7251",
    ],
  },
  {
    file: "Smoking_Cessation_DM-4342_fillable.pdf",
    title: "Cessation tabagique – Ordonnance médicale / Smoking cessation – Physician order",
    code: "DM-4342",
    // right edge aligned with the form (588 pt); page 2 is the titration guidelines, no room for the label
    stamp: { pages: [1], box: { x: 348.6, y: 44.4, w: 242.4, h: 80 } },
    tags: [
      ...MUHC, ...PREPRINTED, "cessation tabagique", "smoking cessation", "tabac", "tobacco", "tabagisme",
      "smoking", "cigarettes", "nicotine", "TRN", "NRT", "timbre", "patch", "gomme", "gum", "pastille", "lozenge",
      "bupropion", "Zyban", "varénicline", "varenicline", "Champix", "IMPACT", "sevrage", "DM-4342",
    ],
  },
  {
    file: "ordo_analgesia_sedation_icu.pdf",
    title: "Pharmaceutical orders – Analgesia and sedation – Adult ICU",
    code: "DM-6225",
    stamp: { ...MUHC_ORDERS_LABEL, pages: [1, 3] }, // pages 2 and 4 are blank backs
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
    stamp: { ...MUHC_ORDERS_LABEL, pages: [1, 2] }, // page 2 (pharmacokinetic table) has room below its name line
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
    stamp: { ...MUHC_ORDERS_LABEL, pages: [1] }, // page 2 is blank
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
    stamp: { ...MUHC_ORDERS_LABEL, pages: [1] }, // page 2 is blank
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
    stamp: { ...MUHC_ORDERS_LABEL, pages: [1] }, // page 2 is blank
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
    stamp: { ...MUHC_ORDERS_LABEL, pages: [1, 3] }, // pages 2 and 4 are blank backs
    tags: [
      ...MUHC, ...ORDERS, "vasopresseurs", "vasopressors", "pressors", "amines", "inotropes",
      "chronotropes", "choc", "shock", "choc cardiogénique", "cardiogenic shock", "norépinéphrine",
      "norepinephrine", "Levophed", "levo", "épinéphrine", "epinephrine", "adrénaline", "vasopressine",
      "vasopressin", "dopamine", "dobutamine", "milrinone", "isoprotérénol", "isoproterenol", "Isuprel",
      "TAM", "MAP", "PAS", "SBP", "perfusion", "infusion", "soins intensifs", "unité coronarienne", "CCU", "USIC",
    ],
  },
];
