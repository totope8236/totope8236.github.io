/*
 * Form repair
 * -----------
 * Re-saving a fillable PDF with macOS Preview (e.g. to draw a box on it) damages its form:
 *   1. Field names are replaced by "button745", "text0"… (or removed entirely). The original names
 *      survive only as the tooltip (/TU).
 *   2. Checkboxes that were mutually exclusive use a "reset form, except these fields" action that
 *      lists the ORIGINAL names. Since those names no longer exist, clicking such a checkbox resets
 *      EVERY field (and in a merged PDF: every field of every document).
 *   3. Radio-button groups are split into one-button "groups" that can never be unticked.
 *   4. Fields without a name are not fields any more (nothing can be typed in them).
 *
 * repair(pdfDoc) fixes these in place, before the document is stamped and merged. It does nothing
 * to forms that are not damaged.
 */
(function () {
  "use strict";
  const { PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString, PDFNumber } = PDFLib;
  const N = (s) => PDFName.of(s);

  const RADIO = 1 << 15;
  const NO_TOGGLE_TO_OFF = 1 << 14;
  const PUSHBUTTON = 1 << 16;

  const text = (o) => (o instanceof PDFString || o instanceof PDFHexString ? o.decodeText() : null);
  const num = (d, k) => { const v = d.lookupMaybe(N(k), PDFNumber); return v ? v.asNumber() : 0; };
  /** Normalised name for loose matching: "Ind. rég 1" == "Ind. rég. 1" */
  const key = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  function onState(widget) {
    const ap = widget.lookupMaybe(N("AP"), PDFDict);
    const n = ap && ap.lookupMaybe(N("N"), PDFDict);
    if (!n) return null;
    const k = n.keys().map((x) => x.toString()).find((x) => x !== "/Off");
    return k ? k.slice(1) : null;
  }

  function acroForm(doc) {
    let form = doc.catalog.lookupMaybe(N("AcroForm"), PDFDict);
    if (!form) {
      form = doc.context.obj({ Fields: [] });
      doc.catalog.set(N("AcroForm"), doc.context.register(form));
    }
    let fields = form.lookupMaybe(N("Fields"), PDFArray);
    if (!fields) { fields = doc.context.obj([]); form.set(N("Fields"), fields); }
    return { form, fields };
  }

  function repair(doc) {
    const ctx = doc.context;
    const report = { named: 0, radioGroups: 0, radioToCheckbox: 0, resetFixed: 0 };

    // ---- collect stand-alone widget fields (widget == field, no parent) ----
    const widgets = []; // { ref, dict, page }
    doc.getPages().forEach((page, p) => {
      const annots = page.node.lookupMaybe(N("Annots"), PDFArray);
      if (!annots) return;
      for (let i = 0; i < annots.size(); i++) {
        const ref = annots.get(i);
        if (!(ref instanceof PDFRef)) continue;
        const dict = ctx.lookup(ref, PDFDict);
        if (dict && dict.get(N("Subtype")) === N("Widget")) widgets.push({ ref, dict, page: p });
      }
    });
    if (!widgets.length) return report;
    const standalone = widgets.filter((w) => !w.dict.get(N("Parent")) && w.dict.get(N("FT")));

    const used = new Set(widgets.map((w) => text(w.dict.get(N("T")))).filter(Boolean));
    const uniqueName = (base) => {
      base = (base || "champ").replace(/\./g, "_").trim() || "champ";
      let name = base, k = 2;
      while (used.has(name)) name = `${base}_${k++}`;
      used.add(name);
      return name;
    };

    // ---- 4. give nameless fields a name (from their tooltip) ----
    for (const w of standalone) {
      if (text(w.dict.get(N("T")))) continue;
      w.dict.set(N("T"), PDFHexString.fromText(uniqueName(text(w.dict.get(N("TU"))))));
      report.named++;
    }

    const { fields } = acroForm(doc);
    const roots = new Map(); // ref string -> { ref, dict }  (all root fields after repair)
    widgets.forEach((w) => {
      let ref = w.ref, dict = w.dict, guard = 0;
      while (dict.get(N("Parent")) instanceof PDFRef && guard++ < 20) { ref = dict.get(N("Parent")); dict = ctx.lookup(ref, PDFDict); }
      roots.set(ref.toString(), { ref, dict });
    });

    // ---- 3. rebuild radio groups that were split into single buttons ----
    const lonelyRadios = standalone.filter((w) => {
      const ff = num(w.dict, "Ff");
      return w.dict.get(N("FT")) === N("Btn") && (ff & RADIO) && !(ff & PUSHBUTTON) && !w.dict.get(N("Kids"));
    });
    const groups = new Map();
    for (const w of lonelyRadios) {
      const g = `${w.page}|${text(w.dict.get(N("TU"))) || text(w.dict.get(N("T")))}`;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(w);
    }
    for (const members of groups.values()) {
      const states = members.map((w) => onState(w.dict));
      const distinct = members.length > 1 && states.every(Boolean) && new Set(states).size === states.length;
      if (!distinct) {
        // can't be grouped safely → behave like checkboxes (can be ticked and unticked)
        for (const w of members) {
          w.dict.set(N("Ff"), PDFNumber.of(num(w.dict, "Ff") & ~(RADIO | NO_TOGGLE_TO_OFF)));
          report.radioToCheckbox++;
        }
        continue;
      }
      const first = members[0].dict;
      const checked = members.find((w, i) => {
        const v = w.dict.get(N("V"));
        return v && v.toString() === "/" + states[i];
      });
      const value = checked ? onState(checked.dict) : "Off";
      const parent = ctx.obj({
        FT: "Btn",
        Ff: num(first, "Ff"),
        T: PDFHexString.fromText(uniqueName(text(first.get(N("TU"))) || "groupe")),
        Kids: members.map((w) => w.ref),
        V: N(value),
      });
      if (first.get(N("TU"))) parent.set(N("TU"), first.get(N("TU")));
      const parentRef = ctx.register(parent);
      members.forEach((w, i) => {
        for (const k of ["T", "FT", "Ff", "V", "DV"]) w.dict.delete(N(k));
        w.dict.set(N("Parent"), parentRef);
        w.dict.set(N("AS"), N(states[i] === value ? value : "Off"));
        roots.delete(w.ref.toString());
      });
      roots.set(parentRef.toString(), { ref: parentRef, dict: parent });
      report.radioGroups++;
    }

    // keep AcroForm /Fields in sync with the root fields found on the pages
    const newFields = ctx.obj([]);
    const seen = new Set();
    for (let i = 0; i < fields.size(); i++) {
      const r = fields.get(i);
      const s = r instanceof PDFRef ? r.toString() : null;
      if (s && !roots.has(s) && standalone.some((w) => w.ref.toString() === s)) continue; // now a kid
      if (s) seen.add(s);
      newFields.push(r);
    }
    for (const [s, { ref }] of roots) if (!seen.has(s)) newFields.push(ref);
    acroForm(doc).form.set(N("Fields"), newFields);

    // ---- 2. repair "reset form" actions ----
    const byName = new Map(), byTip = new Map();
    const add = (m, k, ref) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(ref); };
    for (const { ref, dict } of roots.values()) {
      add(byName, key(text(dict.get(N("T")))), ref);
      add(byTip, key(text(dict.get(N("TU")))), ref);
      const kids = dict.lookupMaybe(N("Kids"), PDFArray);
      if (kids) for (let i = 0; i < kids.size(); i++) {
        const kid = kids.lookupMaybe(i, PDFDict);
        if (kid) add(byTip, key(text(kid.get(N("TU")))), ref);
      }
    }
    const isButton = (d) => d.get(N("FT")) === N("Btn");

    for (const w of widgets) {
      for (const holder of [w.dict, w.dict.lookupMaybe(N("Parent"), PDFDict)].filter(Boolean)) {
        const action = holder.lookupMaybe(N("A"), PDFDict);
        if (!action || action.get(N("S")) !== N("ResetForm")) continue;
        const list = action.lookupMaybe(N("Fields"), PDFArray);
        const resolved = new Set();
        let unresolved = 0;
        if (list) for (let i = 0; i < list.size(); i++) {
          const item = list.get(i);
          if (item instanceof PDFRef) { resolved.add(item.toString()); continue; }
          const k = key(text(item));
          const refs = [...(byName.get(k) || []), ...(byTip.get(k) || [])];
          if (refs.length) refs.forEach((r) => resolved.add(r.toString())); else unresolved++;
        }
        const exclude = num(action, "Flags") & 1;
        if (!unresolved && !exclude) continue; // healthy "reset these fields" action
        let targets;
        if (exclude) {
          // "Reset everything except …" would also wipe the OTHER documents once merged: turn it into an
          // explicit list of this document's fields. If some names couldn't be matched, only reset
          // checkboxes, so a click can never erase typed text.
          targets = [...roots.values()]
            .filter(({ ref, dict }) => !resolved.has(ref.toString()) && (!unresolved || isButton(dict)))
            .map((r) => r.ref);
        } else {
          targets = [...resolved].map((s) => roots.get(s)?.ref).filter(Boolean);
        }
        if (!targets.length) holder.delete(N("A"));
        else {
          action.set(N("Fields"), ctx.obj(targets));
          action.set(N("Flags"), PDFNumber.of(0));
        }
        report.resetFixed++;
      }
    }
    return report;
  }

  /**
   * Chrome (PDFium) only understands field NAMES in a reset action, not references to the fields.
   * repair() stores references (they survive renaming while documents are merged); call this on the
   * final merged document to turn them into the fields' final full names.
   */
  function finalizeResetActions(doc) {
    const ctx = doc.context;
    const fullName = (dict) => {
      const parts = [];
      let d = dict, guard = 0;
      while (d && guard++ < 20) {
        const t = text(d.get(N("T")));
        if (t) parts.unshift(t);
        d = d.lookupMaybe(N("Parent"), PDFDict);
      }
      return parts.join(".");
    };
    const done = new Set();
    for (const page of doc.getPages()) {
      const annots = page.node.lookupMaybe(N("Annots"), PDFArray);
      if (!annots) continue;
      for (let i = 0; i < annots.size(); i++) {
        const w = annots.lookupMaybe(i, PDFDict);
        if (!w) continue;
        for (const holder of [w, w.lookupMaybe(N("Parent"), PDFDict)].filter(Boolean)) {
          const action = holder.lookupMaybe(N("A"), PDFDict);
          if (!action || done.has(action) || action.get(N("S")) !== N("ResetForm")) continue;
          done.add(action);
          const list = action.lookupMaybe(N("Fields"), PDFArray);
          if (!list) continue;
          const names = [];
          for (let k = 0; k < list.size(); k++) {
            const item = list.get(k);
            if (item instanceof PDFRef) {
              const d = ctx.lookup(item, PDFDict);
              const n = d && fullName(d);
              if (n) names.push(PDFHexString.fromText(n));
            } else names.push(item);
          }
          action.set(N("Fields"), ctx.obj(names));
        }
      }
    }
  }

  window.GDFFormFix = { repair, finalizeResetActions };
})();
