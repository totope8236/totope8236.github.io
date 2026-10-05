/*
 * Patient identification label
 * ----------------------------
 * Draws the patient's identification label in the top-right corner of a PDF page, copying the
 * MUHC addressograph label (measured on a scanned order sheet):
 *
 *   744417 F   1939-04-07   BESN39540712  2701     RVH      ← MRN, sex, DOB, RAMQ, RAMQ exp. (YYMM), site
 *   BESSZONG NANCY                                         ← LAST FIRST
 *   79 RUE LEFEBVRE                                        ← number and street
 *   SALABERRY-DE QUE   J6T6A1        450 377-2847          ← CITY (max 12 letters) PROV, postal code, phone
 *       ||||||||||||||||||                                 ← Code 39 barcode of the MRN
 *
 * Everything about *what* is printed and *where* lives in this file, so the layout can be
 * changed without touching the rest of the app.
 *
 * Coordinates in this file are in PDF points (1 pt = 1/72 in), measured from the TOP-LEFT
 * corner of the page (like a screen), and converted internally to PDF's bottom-left origin.
 * A Letter page is 612 × 792 pt.
 */
(function () {
  "use strict";
  const { rgb, StandardFonts, PDFName, pushGraphicsState, popGraphicsState, beginText, endText,
    setFontAndSize, setCharacterSqueeze, setTextMatrix, showText, setFillingRgbColor } = PDFLib;

  // Where the label goes: the patient-identification box printed on Québec forms
  // (x 342 → 570, y 42 → 162 on a Letter page). Anchored to the top-right corner, so
  // pages of other sizes keep the same margins.
  const DEFAULT_STAMP = {
    pages: "all",          // "all" or a list of 1-based page numbers, e.g. [1]
    marginRight: 42,       // pt from the right edge of the page
    marginTop: 42,         // pt from the top edge of the page
    width: 228,
    height: 120,
    padding: 3,            // space between the box and the label
    offsetTop: 8,          // extra space above the first line of text
    fitToBox: true,        // squeeze the TEXT horizontally if the label is wider than the box (barcode never changes)
    border: false,         // draw a thin frame around the box
    barcode: true,         // Code 39 barcode of the MRN
  };

  // Measurements of the real label (pt). x positions are from the left edge of the text,
  // y positions from the top of the capital letters of the first line.
  const LABEL = {
    fontSize: 9,           // Helvetica, regular
    lineHeight: 8.6,       // distance between lines
    line1: { mrn: 0, sex: 34.9, dob: 50.2, ramq: 108.4, ramqExp: 181.4, site: 217.3 },
    line4: { city: 0, postalCode: 101.0, phone: 162.0 },
    cityMaxChars: 12,      // the label printer truncates the city ("SALABERRY-DE")
    barcode: {
      x: 23.1,             // from the left edge of the text
      top: 41.5,           // from the top of the first line
      height: 17,
      narrow: 0.595,       // narrow bar / space width (≈0.21 mm)
      ratio: 2.5,          // wide = 2.5 × narrow  → a 6-digit MRN is 68.4 pt (24 mm) wide, as on the label
    },
  };

  // ---------- Code 39 ----------
  // 9 elements per character (bar, space, bar, ...), "w" = wide, "n" = narrow.
  const CODE39 = {
    "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
    "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
    A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
    F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
    K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn",
    P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
    U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn",
    Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
    $: "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn",
  };

  /** Draw a Code 39 barcode with a fixed bar width; (x, yBottom) in PDF coordinates. */
  function drawCode39(page, text, x, yBottom, height, narrow = LABEL.barcode.narrow, ratio = LABEL.barcode.ratio) {
    text = String(text || "").toUpperCase().trim();
    if (!text || [...text].some((c) => !CODE39[c] || c === "*")) return false;
    let cx = x;
    for (const ch of "*" + text + "*") {
      const pat = CODE39[ch];
      for (let i = 0; i < 9; i++) {
        const w = (pat[i] === "w" ? ratio : 1) * narrow;
        if (i % 2 === 0) page.drawRectangle({ x: cx, y: yBottom, width: w, height, color: rgb(0, 0, 0) });
        cx += w;
      }
      cx += narrow; // gap between characters
    }
    return true;
  }

  // ---------- text helpers ----------
  /** Capitals without accents, as printed by the hospital's label printer. */
  const plainCaps = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

  /** Helvetica only covers WinAnsi (Latin-1-ish). Replace anything else by its unaccented form or "?". */
  function safeText(font, s) {
    let out = "";
    for (const ch of String(s ?? "")) {
      if (canEncode(font, ch)) { out += ch; continue; }
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += base && canEncode(font, base) ? base : "?";
    }
    return out;
  }
  function canEncode(font, ch) {
    try { font.encodeText(ch); return true; } catch (e) { return false; }
  }

  // ---------- content ----------
  const digits = (s) => String(s ?? "").replace(/\D/g, "");

  /**
   * The label's content as positioned pieces: lines[i] = [{ x, text }, …]
   * p = patient object from the form (see app.js → readPatient()).
   */
  function labelLines(p) {
    const exp = digits(p.ramqExp); // "2027-01" → "202701" → "2701"
    const phone = digits(p.phone).replace(/^1(?=\d{10}$)/, "");
    const city = plainCaps(p.city).slice(0, LABEL.cityMaxChars).trim();
    const L1 = LABEL.line1, L4 = LABEL.line4;
    return [
      [
        { x: L1.mrn, text: plainCaps(p.mrn) },
        { x: L1.sex, text: plainCaps(p.sex).slice(0, 1) },
        { x: L1.dob, text: p.dob || "" },                                  // YYYY-MM-DD
        { x: L1.ramq, text: plainCaps(p.ramq).replace(/\s+/g, "") },       // BESN39540712
        { x: L1.ramqExp, text: exp.length >= 4 ? exp.slice(-4) : exp },    // YYMM
        { x: L1.site, text: plainCaps(p.site) },
      ],
      [{ x: 0, text: [plainCaps(p.lastName), plainCaps(p.firstName)].filter(Boolean).join(" ") }],
      [{ x: 0, text: plainCaps(p.address) }],
      [
        { x: L4.city, text: [city, plainCaps(p.province)].filter(Boolean).join(" ") },
        { x: L4.postalCode, text: plainCaps(p.postalCode).replace(/\s+/g, "") },
        { x: L4.phone, text: phone.length === 10 ? `${phone.slice(0, 3)} ${phone.slice(3, 6)}-${phone.slice(6)}` : p.phone || "" },
      ],
    ];
  }

  /** Lay out the pieces: a piece never overlaps the previous one on its line. Returns the label width. */
  function layout(lines, font, size) {
    const space = font.widthOfTextAtSize(" ", size);
    let width = 0;
    for (const line of lines) {
      let end = -Infinity;
      for (const piece of line) {
        piece.text = safeText(font, piece.text);
        if (!piece.text) continue;
        piece.x = Math.max(piece.x, end + space);
        end = piece.x + font.widthOfTextAtSize(piece.text, size);
        width = Math.max(width, end);
      }
    }
    return width;
  }

  /** Draw text with an optional horizontal squeeze (100 = normal width). PDF coordinates. */
  function drawSqueezed(page, font, size, text, x, y, squeeze) {
    const key = page.node.newFontDictionary(font.name, font.ref);
    page.pushOperators(
      pushGraphicsState(),
      setFillingRgbColor(0, 0, 0),
      beginText(),
      setFontAndSize(key, size),
      setCharacterSqueeze(squeeze),
      setTextMatrix(1, 0, 0, 1, x, y),
      showText(font.encodeText(text)),
      endText(),
      popGraphicsState()
    );
  }

  // ---------- annotations covering the stamp area ----------
  // PDF viewers always draw annotations ON TOP of the page content. The forms in docs/ have a
  // white-filled rectangle annotation over the identification box (added in Preview), which would
  // hide the stamp. Such annotations (anything except form fields/links) overlapping the stamp area
  // are therefore "flattened": their appearance is drawn into the page, then the annotation is removed.
  const SKIP_SUBTYPES = new Set(["/Widget", "/Link", "/Popup"]);

  function flattenAnnotsOver(page, area /* PDF coords: x1,y1,x2,y2 */) {
    const { PDFName, PDFArray, PDFDict, PDFRef, pushGraphicsState, popGraphicsState,
      concatTransformationMatrix, drawObject } = PDFLib;
    const N = (s) => PDFName.of(s);
    const annots = page.node.lookupMaybe(N("Annots"), PDFArray);
    if (!annots) return;
    const ctx = page.doc.context;
    const num = (arr, i) => arr.lookup(i).asNumber();
    const toRemove = [];

    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookupMaybe(i, PDFDict);
      if (!a) continue;
      const sub = a.get(N("Subtype"));
      if (!sub || SKIP_SUBTYPES.has(sub.toString())) continue;
      const flags = a.get(N("F")) ? a.lookup(N("F")).asNumber() : 0;
      if (flags & (2 | 32)) continue; // hidden / no-view
      const r = a.lookupMaybe(N("Rect"), PDFArray);
      if (!r) continue;
      const rx1 = Math.min(num(r, 0), num(r, 2)), rx2 = Math.max(num(r, 0), num(r, 2));
      const ry1 = Math.min(num(r, 1), num(r, 3)), ry2 = Math.max(num(r, 1), num(r, 3));
      if (rx2 <= area.x1 || rx1 >= area.x2 || ry2 <= area.y1 || ry1 >= area.y2) continue;

      // normal appearance stream
      const ap = a.lookupMaybe(N("AP"), PDFDict);
      if (!ap) continue;
      let apRef = ap.get(N("N"));
      if (!(apRef instanceof PDFRef)) {
        const states = ap.lookupMaybe(N("N"), PDFDict);
        const as = a.get(N("AS"));
        apRef = states && as ? states.get(as) : null;
      }
      if (!(apRef instanceof PDFRef)) continue;
      const stream = ctx.lookup(apRef);
      if (!stream || !stream.dict) continue;
      const bb = stream.dict.lookupMaybe(N("BBox"), PDFArray);
      if (!bb) continue;
      const mArr = stream.dict.lookupMaybe(N("Matrix"), PDFArray);
      const m = mArr ? [0, 1, 2, 3, 4, 5].map((k) => num(mArr, k)) : [1, 0, 0, 1, 0, 0];
      const corners = [[num(bb, 0), num(bb, 1)], [num(bb, 2), num(bb, 1)], [num(bb, 0), num(bb, 3)], [num(bb, 2), num(bb, 3)]]
        .map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
      const bx1 = Math.min(...corners.map((c) => c[0])), bx2 = Math.max(...corners.map((c) => c[0]));
      const by1 = Math.min(...corners.map((c) => c[1])), by2 = Math.max(...corners.map((c) => c[1]));
      if (bx2 - bx1 <= 0 || by2 - by1 <= 0) continue;
      const sx = (rx2 - rx1) / (bx2 - bx1), sy = (ry2 - ry1) / (by2 - by1);

      const name = page.node.newXObject("FlatAnnot", apRef);
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(sx, 0, 0, sy, rx1 - bx1 * sx, ry1 - by1 * sy),
        drawObject(name),
        popGraphicsState()
      );
      toRemove.push(i);
    }
    for (let k = toRemove.length - 1; k >= 0; k--) annots.remove(toRemove[k]);
  }

  // ---------- public API ----------
  /**
   * Stamp every (selected) page of a PDFDocument.
   * @param {PDFLib.PDFDocument} pdfDoc
   * @param {object} patient
   * @param {object} [override] per-document overrides from catalog.js (entry.stamp)
   * @param {Array<PDFLib.PDFPage>} [pages] pages to consider (default: all pages of pdfDoc)
   */
  async function stampDocument(pdfDoc, patient, override, pages) {
    const cfg = Object.assign({}, DEFAULT_STAMP, override || {});
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const size = LABEL.fontSize;
    const lines = labelLines(patient);
    const naturalWidth = layout(lines, font, size);
    const hasText = lines.some((l) => l.some((p) => p.text));
    const hasBarcode = cfg.barcode && patient.mrn;
    if (!hasText && !hasBarcode) return;

    pages = pages || pdfDoc.getPages();
    pages.forEach((page, idx) => {
      const pageNo = idx + 1;
      if (cfg.pages !== "all" && !cfg.pages.includes(pageNo)) return;

      const { x: ox, y: oy, width: W, height: H } = page.getCropBox();
      // box in top-left coordinates
      const box = cfg.box
        ? cfg.box
        : { x: W - cfg.marginRight - cfg.width, y: cfg.marginTop, w: cfg.width, h: cfg.height };

      flattenAnnotsOver(page, {
        x1: ox + box.x, x2: ox + box.x + box.w,
        y1: oy + H - box.y - box.h, y2: oy + H - box.y,
      });
      if (cfg.border) {
        page.drawRectangle({
          x: ox + box.x, y: oy + H - box.y - box.h, width: box.w, height: box.h,
          borderColor: rgb(0, 0, 0), borderWidth: 0.6,
        });
      }

      const available = box.w - 2 * cfg.padding;
      const squeeze = cfg.fitToBox && naturalWidth > available ? available / naturalWidth : 1;
      const left = ox + box.x + cfg.padding;
      const capTop = oy + H - box.y - cfg.padding - cfg.offsetTop; // PDF y of the top of line 1
      const capHeight = font.heightAtSize(size, { descender: false });

      lines.forEach((line, i) => {
        const baseline = capTop - capHeight - i * LABEL.lineHeight;
        for (const piece of line) {
          if (piece.text) drawSqueezed(page, font, size, piece.text, left + piece.x * squeeze, baseline, squeeze * 100);
        }
      });

      if (hasBarcode) {
        const b = LABEL.barcode;
        drawCode39(page, patient.mrn, left + b.x, capTop - b.top - b.height, b.height);
      }
    });
  }

  window.GDFStamp = { stampDocument, labelLines, drawCode39, DEFAULT_STAMP, LABEL };
})();
