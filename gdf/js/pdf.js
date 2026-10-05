/*
 * PDF loading + merging
 * ---------------------
 * - Reads PDFs from docs/ (fetch), or from a folder the user picked when the page is opened from disk.
 * - Builds one PDF from several documents, stamping each page with the patient's information.
 * - Keeps fillable form fields working after the merge (pdf-lib's copyPages() copies the widgets
 *   but not the form itself, so the fields are re-attached to the merged document's AcroForm).
 */
(function () {
  "use strict";
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString, PDFObjectCopier } = PDFLib;

  const bytesCache = new Map(); // file name -> Promise<Uint8Array>
  const pickedFiles = new Map(); // file name -> File (folder picker fallback)

  function addPickedFiles(fileList) {
    let n = 0;
    for (const f of fileList) {
      if (/\.pdf$/i.test(f.name)) { pickedFiles.set(f.name, f); n++; }
    }
    // forget failed fetches so they are retried from the picked files
    for (const [k, p] of bytesCache) p.catch(() => bytesCache.delete(k));
    return n;
  }

  function getBytes(file) {
    if (!bytesCache.has(file)) {
      const p = (async () => {
        if (pickedFiles.has(file)) return new Uint8Array(await pickedFiles.get(file).arrayBuffer());
        const res = await fetch("docs/" + encodeURIComponent(file));
        if (!res.ok) throw new Error(`Could not load docs/${file} (HTTP ${res.status})`);
        return new Uint8Array(await res.arrayBuffer());
      })();
      bytesCache.set(file, p);
      p.catch(() => bytesCache.delete(file));
    }
    return bytesCache.get(file);
  }

  async function loadDoc(file) {
    const bytes = await getBytes(file);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
    try {
      GDFFormFix.repair(doc);
    } catch (e) {
      console.warn("Form repair skipped for " + file, e);
    }
    return doc;
  }

  // ---------- form helpers ----------
  const N = (s) => PDFName.of(s);

  function acroForm(doc) {
    return doc.catalog.lookupMaybe(N("AcroForm"), PDFDict);
  }

  function decodeName(obj) {
    if (obj instanceof PDFString || obj instanceof PDFHexString) return obj.decodeText();
    return null;
  }

  /** Rename top-level fields whose name was already used by a previous document (avoids two fields sharing a value). */
  function dedupeFieldNames(doc, usedNames) {
    const form = acroForm(doc);
    if (!form) return;
    const fields = form.lookupMaybe(N("Fields"), PDFArray);
    if (!fields) return;
    const mine = [];
    for (let i = 0; i < fields.size(); i++) {
      const f = fields.lookupMaybe(i, PDFDict);
      if (!f) continue;
      let name = decodeName(f.get(N("T")));
      if (name == null) continue;
      if (usedNames.has(name)) {
        let k = 2;
        while (usedNames.has(`${name}_${k}`)) k++;
        name = `${name}_${k}`;
        f.set(N("T"), PDFHexString.fromText(name));
      }
      mine.push(name);
    }
    mine.forEach((n) => usedNames.add(n));
  }

  /** Make sure the merged document has an AcroForm, and bring over default appearance resources. */
  function ensureDestForm(dest, src) {
    let form = acroForm(dest);
    if (!form) {
      form = dest.context.obj({ Fields: [] });
      dest.catalog.set(N("AcroForm"), dest.context.register(form));
    }
    const srcForm = acroForm(src);
    if (srcForm) {
      const copier = PDFObjectCopier.for(src.context, dest.context);
      // Default appearance string
      if (!form.get(N("DA")) && srcForm.get(N("DA"))) form.set(N("DA"), copier.copy(srcForm.get(N("DA"))));
      // Default resources (fonts used by the fields' DA strings)
      const srcDR = srcForm.lookupMaybe(N("DR"), PDFDict);
      if (srcDR) {
        let dr = form.lookupMaybe(N("DR"), PDFDict);
        if (!dr) { dr = dest.context.obj({}); form.set(N("DR"), dr); }
        for (const [key, val] of srcDR.entries()) {
          const srcSub = src.context.lookup(val);
          if (srcSub instanceof PDFDict) {
            let sub = dr.lookupMaybe(key, PDFDict);
            if (!sub) { sub = dest.context.obj({}); dr.set(key, sub); }
            for (const [k2, v2] of srcSub.entries()) if (!sub.has(k2)) sub.set(k2, copier.copy(v2));
          } else if (!dr.has(key)) {
            dr.set(key, copier.copy(val));
          }
        }
      }
      if (srcForm.get(N("NeedAppearances"))) form.set(N("NeedAppearances"), srcForm.get(N("NeedAppearances")));
    }
    return form;
  }

  /** After copying pages, register the root fields of every widget on those pages in the merged AcroForm. */
  function attachFields(dest, pages, form) {
    const fields = form.lookupMaybe(N("Fields"), PDFArray) || (() => {
      const a = dest.context.obj([]); form.set(N("Fields"), a); return a;
    })();
    const seen = new Set();
    for (let i = 0; i < fields.size(); i++) {
      const r = fields.get(i);
      if (r instanceof PDFRef) seen.add(r.toString());
    }
    for (const page of pages) {
      const annots = page.node.lookupMaybe(N("Annots"), PDFArray);
      if (!annots) continue;
      for (let i = 0; i < annots.size(); i++) {
        let ref = annots.get(i);
        if (!(ref instanceof PDFRef)) continue;
        let dict = dest.context.lookup(ref, PDFDict);
        if (!dict || dict.get(N("Subtype")) !== N("Widget")) continue;
        let guard = 0;
        while (dict.get(N("Parent")) instanceof PDFRef && guard++ < 20) {
          ref = dict.get(N("Parent"));
          dict = dest.context.lookup(ref, PDFDict);
        }
        const key = ref.toString();
        if (!seen.has(key)) { seen.add(key); fields.push(ref); }
      }
    }
  }

  // ---------- public ----------
  /**
   * Build one PDF from catalog entries.
   * @param {Array<object>} entries catalog entries, in print order
   * @param {object|null} patient patient object, or null for blank forms
   * @returns {Promise<Uint8Array>}
   */
  async function buildPdf(entries, patient, { title } = {}) {
    const dest = await PDFDocument.create();
    const usedNames = new Set();
    let form = null;

    for (const entry of entries) {
      const src = await loadDoc(entry.file);
      dedupeFieldNames(src, usedNames);
      if (patient) await GDFStamp.stampDocument(src, patient, entry.stamp);

      const copied = await dest.copyPages(src, src.getPageIndices());
      copied.forEach((p) => dest.addPage(p));
      if (acroForm(src)) {
        form = ensureDestForm(dest, src);
        attachFields(dest, copied, form);
      }
    }

    if (form) GDFFormFix.finalizeResetActions(dest);
    dest.setTitle(title || entries.map((e) => e.title).join(" + "), { showInWindowTitleBar: true });
    dest.setProducer("GDF");
    dest.setCreator("GDF");
    return dest.save();
  }

  async function pageCount(file) {
    const doc = await loadDoc(file);
    return doc.getPageCount();
  }

  window.GDFPdf = { buildPdf, pageCount, getBytes, addPickedFiles };
})();
