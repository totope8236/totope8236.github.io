/*
 * GDF – UI logic: search table, print queue, preview, patient form.
 */
(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  // ---------- catalog ----------
  const catalog = (window.GDF_CATALOG || []).map((e, i) => ({
    id: i,
    tags: [],
    code: "",
    ...e,
    title: e.title || e.file.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "),
  }));
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const pages = new Map(); // id -> page count (filled lazily)

  // ---------- state ----------
  const state = {
    query: "",
    results: catalog.slice(),
    queue: [], // ids, in print order
    previewId: null,
    activeIndex: -1, // keyboard cursor in results
  };

  // ---------- text normalisation / search ----------
  const stripChar = (ch) => ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const norm = (s) => [...String(s)].map(stripChar).join("").replace(/[–—]/g, "-");

  /** Normalised text + map from normalised index to original index (for highlighting). */
  function normWithMap(s) {
    let out = "", map = [];
    [...String(s)].forEach((ch, i) => {
      const n = stripChar(ch).replace(/[–—]/g, "-");
      for (const c of n) { out += c; map.push(i); }
    });
    return { out, map, chars: [...String(s)] };
  }

  function terms(q) {
    return norm(q).split(/[\s,;]+/).map((t) => t.replace(/^[-–]+|[-–]+$/g, "")).filter(Boolean);
  }

  function search(q) {
    const ts = terms(q);
    if (!ts.length) return catalog.slice().sort((a, b) => a.title.localeCompare(b.title, "fr"));
    const scored = [];
    for (const e of catalog) {
      const title = norm(e.title), code = norm(e.code), file = norm(e.file);
      const tags = e.tags.map(norm);
      let score = 0, ok = true;
      for (const t of ts) {
        let s = 0;
        if (title.includes(t)) s += title.split(/[\s\-()]+/).some((w) => w.startsWith(t)) ? 6 : 4;
        if (code.includes(t) || file.includes(t)) s += 5;
        for (const tag of tags) {
          if (tag === t) s += 5;
          else if (tag.startsWith(t)) s += 3;
          else if (tag.includes(t)) s += 1;
        }
        if (!s) { ok = false; break; }
        score += s;
      }
      if (ok) scored.push({ e, score });
    }
    scored.sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title, "fr"));
    return scored.map((x) => x.e);
  }

  function highlight(text, ts) {
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!ts.length) return esc(text);
    const { out, map, chars } = normWithMap(text);
    const mark = new Array(chars.length).fill(false);
    for (const t of ts) {
      let i = out.indexOf(t);
      while (i !== -1) {
        for (let k = i; k < i + t.length; k++) mark[map[k]] = true;
        i = out.indexOf(t, i + 1);
      }
    }
    let html = "", open = false;
    chars.forEach((c, i) => {
      if (mark[i] && !open) { html += "<mark>"; open = true; }
      if (!mark[i] && open) { html += "</mark>"; open = false; }
      html += esc(c);
    });
    return html + (open ? "</mark>" : "");
  }

  // ---------- table ----------
  const body = $("#docBody");

  function renderTable() {
    const ts = terms(state.query);
    body.innerHTML = "";
    state.results.forEach((e, idx) => {
      const tr = document.createElement("tr");
      tr.dataset.id = e.id;
      tr.tabIndex = -1;
      if (state.queue.includes(e.id)) tr.classList.add("selected");
      if (state.previewId === e.id) tr.classList.add("previewing");
      if (idx === state.activeIndex) tr.classList.add("active");

      const n = pages.get(e.id);
      const matchingTags = ts.length ? e.tags.filter((t) => ts.some((q) => norm(t).includes(q))) : [];
      const otherTags = e.tags.filter((t) => !matchingTags.includes(t));
      const shownTags = [...matchingTags, ...otherTags].slice(0, Math.max(5, matchingTags.length));
      const hidden = e.tags.length - shownTags.length;

      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" aria-label="Select ${e.title.replace(/"/g, "")}" ${state.queue.includes(e.id) ? "checked" : ""}></td>
        <td class="col-title">
          <div class="doc-title">${highlight(e.title, ts)}</div>
          <div class="doc-file">${highlight(e.file, ts)}${n ? ` · ${n} p.` : ""}</div>
        </td>
        <td class="col-code mono">${(e.code || "").split(/\s*[·|,]\s*/).map((c) => `<span class="code-part">${highlight(c, ts)}</span>`).join("")}</td>
        <td class="col-tags">${shownTags.map((t) => `<button type="button" class="tag${matchingTags.includes(t) ? " hit" : ""}" data-tag="${t.replace(/"/g, "&quot;")}">${highlight(t, ts)}</button>`).join("")}${hidden > 0 ? `<span class="tag more" title="${e.tags.slice(shownTags.length).join(", ").replace(/"/g, "")}">+${hidden}</span>` : ""}</td>`;
      body.appendChild(tr);
    });

    $("#emptyState").hidden = state.results.length > 0;
    $("#resultCount").textContent = state.query
      ? `${state.results.length} of ${catalog.length}`
      : `${catalog.length} document${catalog.length === 1 ? "" : "s"}`;
    updateCheckAll();
  }

  function updateCheckAll() {
    const ids = state.results.map((e) => e.id);
    const sel = ids.filter((id) => state.queue.includes(id)).length;
    const box = $("#checkAll");
    box.checked = ids.length > 0 && sel === ids.length;
    box.indeterminate = sel > 0 && sel < ids.length;
  }

  function toggle(id, on) {
    const i = state.queue.indexOf(id);
    if (on === undefined) on = i === -1;
    if (on && i === -1) state.queue.push(id);
    if (!on && i !== -1) state.queue.splice(i, 1);
    renderTable();
    renderQueue();
  }

  body.addEventListener("click", (ev) => {
    const tr = ev.target.closest("tr");
    if (!tr) return;
    const id = +tr.dataset.id;
    if (ev.target.matches(".tag[data-tag]")) {
      setQuery(ev.target.dataset.tag);
      return;
    }
    if (ev.target.matches('input[type="checkbox"]')) {
      toggle(id, ev.target.checked);
      return;
    }
    if (ev.target.closest(".col-check")) { toggle(id); return; }
    state.activeIndex = state.results.findIndex((e) => e.id === id);
    showPreview(id);
  });
  body.addEventListener("dblclick", (ev) => {
    const tr = ev.target.closest("tr");
    if (tr && !ev.target.closest(".col-check, .tag")) toggle(+tr.dataset.id);
  });

  $("#checkAll").addEventListener("change", (ev) => {
    const ids = state.results.map((e) => e.id);
    if (ev.target.checked) ids.forEach((id) => { if (!state.queue.includes(id)) state.queue.push(id); });
    else state.queue = state.queue.filter((id) => !ids.includes(id));
    renderTable();
    renderQueue();
  });

  // ---------- search box ----------
  const searchInput = $("#search");
  function setQuery(q) {
    searchInput.value = q;
    runSearch();
    searchInput.focus();
  }
  function runSearch() {
    state.query = searchInput.value;
    state.results = search(state.query);
    state.activeIndex = state.results.length ? 0 : -1;
    renderTable();
  }
  searchInput.addEventListener("input", runSearch);

  // Keyboard: "/" focuses search; ↑/↓ move; Enter = preview; Space (in search: Ctrl/⌘+Enter) = tick
  document.addEventListener("keydown", (ev) => {
    const inField = ev.target.matches("input, select, textarea") && ev.target !== searchInput;
    if (ev.key === "/" && !inField && ev.target !== searchInput) {
      ev.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (inField) return;
    const inSearch = ev.target === searchInput;
    const n = state.results.length;
    if (!n) return;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      state.activeIndex = Math.max(0, Math.min(n - 1, state.activeIndex + (ev.key === "ArrowDown" ? 1 : -1)));
      renderTable();
      body.children[state.activeIndex]?.scrollIntoView({ block: "nearest" });
    } else if (ev.key === "Enter" && state.activeIndex >= 0) {
      ev.preventDefault();
      const id = state.results[state.activeIndex].id;
      if (ev.metaKey || ev.ctrlKey) toggle(id); else showPreview(id);
    } else if (ev.key === " " && !inSearch && state.activeIndex >= 0 && !ev.target.matches("button, input")) {
      ev.preventDefault();
      toggle(state.results[state.activeIndex].id);
    }
  });

  // ---------- print queue ----------
  const queueList = $("#queueList");
  let dragId = null;

  function renderQueue() {
    queueList.innerHTML = "";
    state.queue.forEach((id, i) => {
      const e = byId.get(id);
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.id = id;
      li.innerHTML = `<span class="grip" aria-hidden="true">⋮⋮</span><span class="qnum">${i + 1}</span>
        <span class="qtitle" title="${e.file}">${e.title}</span>
        <button type="button" class="qbtn" data-act="up" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="qbtn" data-act="down" title="Move down" ${i === state.queue.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="qbtn" data-act="remove" title="Remove">✕</button>`;
      queueList.appendChild(li);
      if (!pages.has(id)) loadPageCount(id);
    });

    const nDocs = state.queue.length;
    const nPages = state.queue.reduce((s, id) => s + (pages.get(id) || 0), 0);
    const allKnown = state.queue.every((id) => pages.has(id));
    $("#queueInfo").textContent = nDocs
      ? `${nDocs} document${nDocs > 1 ? "s" : ""}${allKnown ? ` · ${nPages} page${nPages > 1 ? "s" : ""}` : ""} · drag to reorder`
      : "Tick documents to add them";
    $("#clearQueue").hidden = !nDocs;
    $("#printBtn").disabled = !nDocs;
    $("#downloadBtn").disabled = !nDocs;
  }

  async function loadPageCount(id) {
    pages.set(id, 0);
    try {
      pages.set(id, await GDFPdf.pageCount(byId.get(id).file));
      renderQueue();
      renderTable();
    } catch (e) {
      pages.delete(id);
    }
  }

  queueList.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".qbtn");
    if (!btn) return;
    const id = +btn.closest("li").dataset.id;
    const i = state.queue.indexOf(id);
    if (btn.dataset.act === "remove") { toggle(id, false); return; }
    const j = btn.dataset.act === "up" ? i - 1 : i + 1;
    [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
    renderQueue();
  });
  queueList.addEventListener("dragstart", (ev) => {
    const li = ev.target.closest("li");
    dragId = +li.dataset.id;
    li.classList.add("dragging");
    ev.dataTransfer.effectAllowed = "move";
  });
  queueList.addEventListener("dragend", () => { dragId = null; renderQueue(); });
  queueList.addEventListener("dragover", (ev) => {
    if (dragId == null) return;
    ev.preventDefault();
    const li = ev.target.closest("li");
    if (!li || +li.dataset.id === dragId) return;
    const from = state.queue.indexOf(dragId);
    const to = state.queue.indexOf(+li.dataset.id);
    state.queue.splice(from, 1);
    state.queue.splice(to, 0, dragId);
    const dragging = queueList.querySelector(".dragging");
    if (from < to) li.after(dragging); else li.before(dragging);
  });
  $("#clearQueue").addEventListener("click", () => {
    state.queue = [];
    renderTable();
    renderQueue();
  });

  // ---------- patient form ----------
  const form = $("#patientForm");

  function readPatient() {
    const f = new FormData(form);
    const p = {};
    for (const k of ["site", "mrn", "lastName", "firstName", "dob", "sex", "ramq", "ramqExp", "address", "city", "province", "postalCode", "phone"]) {
      p[k] = String(f.get(k) || "").trim();
    }
    return p;
  }
  function hasPatient(p) {
    return ["mrn", "lastName", "firstName", "dob", "ramq", "address", "city", "phone"].some((k) => p[k]);
  }

  const fmt = {
    ramq(v) {
      const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (/^[A-Z]{4}\d{8}$/.test(s)) return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8)}`;
      return v.toUpperCase().trim();
    },
    ramqExp(v) {
      const d = v.replace(/\D/g, "");
      if (d.length === 6) return `${d.slice(0, 4)}-${d.slice(4)}`;        // 202705
      if (d.length === 4) return `20${d.slice(0, 2)}-${d.slice(2)}`;      // 2705 (as on the card: YY MM)
      return v.trim();
    },
    postalCode(v) {
      const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(s) ? `${s.slice(0, 3)} ${s.slice(3)}` : v.toUpperCase().trim();
    },
    phone(v) {
      let d = v.replace(/\D/g, "");
      if (d.length === 11 && d[0] === "1") d = d.slice(1);
      return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : v.trim();
    },
    mrn: (v) => v.trim().toUpperCase(),
    province: (v) => v.trim().toUpperCase(),
  };
  const valid = {
    ramq: (v) => !v || /^[A-Z]{4} \d{4} \d{4}$/.test(v),
    ramqExp: (v) => !v || /^\d{4}-(0[1-9]|1[0-2])$/.test(v),
    postalCode: (v) => !v || /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(v),
    phone: (v) => !v || /^\(\d{3}\) \d{3}-\d{4}$/.test(v) || /\d{3}.*\d{4}/.test(v),
    mrn: (v) => !v || /^[A-Z0-9\-. $/+%]+$/.test(v),
  };

  form.addEventListener("focusout", (ev) => {
    const el = ev.target;
    if (fmt[el.name]) el.value = fmt[el.name](el.value);
    if (valid[el.name]) el.classList.toggle("invalid", !valid[el.name](el.value));
    if (el.name === "ramq") ramqDerive(true);
    onPatientChange();
  });
  form.addEventListener("input", (ev) => {
    ev.target.classList.remove("invalid");
    if (ev.target.name === "ramq") ramqDerive(false);
    onPatientChange();
  });
  form.addEventListener("change", onPatientChange);
  form.addEventListener("submit", (ev) => ev.preventDefault());

  /** RAMQ number = LLLF YYMM DDxx  (month + 50 for female). Fill DOB / sex when empty, warn on mismatch. */
  function ramqDerive(fill) {
    const hint = $("#ramqHint");
    const s = form.ramq.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    hint.hidden = true;
    if (!/^[A-Z]{4}\d{8}$/.test(s)) return;
    const yy = +s.slice(4, 6);
    let mm = +s.slice(6, 8);
    const dd = +s.slice(8, 10);
    let sex = "M";
    if (mm > 50) { mm -= 50; sex = "F"; }
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return;
    const nowYY = new Date().getFullYear() % 100;
    const yyyy = (yy <= nowYY ? 2000 : 1900) + yy;
    const dob = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

    if (fill) {
      if (!form.dob.value) form.dob.value = dob;
      if (!form.sex.value) form.sex.value = sex;
    }
    const msgs = [];
    if (form.dob.value && form.dob.value.slice(2) !== dob.slice(2)) msgs.push(`date of birth (${dob.slice(2)})`);
    if (form.sex.value && form.sex.value !== "X" && form.sex.value !== sex) msgs.push(`sex (${sex})`);
    if (msgs.length) {
      hint.textContent = `RAMQ number suggests a different ${msgs.join(" and ")}.`;
      hint.hidden = false;
    }
  }

  function updatePatientChip() {
    const p = readPatient();
    const chip = $("#patientChip");
    if (!hasPatient(p)) {
      chip.className = "patient-chip empty";
      chip.textContent = "No patient entered";
      return;
    }
    chip.className = "patient-chip";
    const name = [p.lastName.toUpperCase(), p.firstName].filter(Boolean).join(", ") || "Unnamed patient";
    chip.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = name;
    chip.append(b, document.createTextNode([p.mrn && " · MRN " + p.mrn, p.site && " · " + p.site].filter(Boolean).join("")));
  }

  let previewTimer = null;
  function onPatientChange() {
    updatePatientChip();
    if (state.previewId != null && $("#stampPreview").checked) {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => showPreview(state.previewId), 700);
    }
  }

  $("#clearPatient").addEventListener("click", () => {
    form.reset();
    form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    $("#ramqHint").hidden = true;
    setPasteStatus("");
    onPatientChange();
    form.mrn.focus();
  });

  // ---------- paste the patient banner from the hospital system ----------
  function setPasteStatus(msg, kind = "") {
    const el = $("#pasteStatus");
    el.textContent = msg;
    el.className = "paste-status " + kind;
  }

  /** Fill the form from a pasted banner. Replaces the current patient entirely. */
  function fillFromBanner(text) {
    const { fields, missing } = GDFParse.parsePatient(text);
    if (!fields.mrn && !fields.lastName) {
      setPasteStatus("Couldn't read patient information from this text.", "err");
      return false;
    }
    // start from a clean form so nothing from the previous patient is left behind (e.g. the phone)
    form.reset();
    form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    $("#ramqHint").hidden = true;

    const notes = [];
    for (const [k, v] of Object.entries(fields)) {
      if (k === "site") {
        const radio = form.querySelector(`input[name="site"][value="${v}"]`);
        if (radio) radio.checked = true;
        else notes.push(`site ${v} isn't RVH/MGH`);
        continue;
      }
      const el = form.elements[k];
      if (!el) continue;
      el.value = fmt[k] ? fmt[k](v) : v;
      if (valid[k]) el.classList.toggle("invalid", !valid[k](el.value));
      el.classList.remove("just-filled");
      void el.offsetWidth; // restart the highlight animation
      el.classList.add("just-filled");
    }
    ramqDerive(false); // warn if the RAMQ number doesn't match DOB / sex
    onPatientChange();

    const gaps = [...missing, "phone"];
    const msg = `Filled from the pasted text. Not in the text: ${gaps.join(", ")}.` + (notes.length ? ` (${notes.join("; ")})` : "");
    setPasteStatus(msg, missing.length || notes.length ? "warn" : "ok");
    return true;
  }

  const pasteInput = $("#pasteInput");
  pasteInput.addEventListener("paste", () => {
    setTimeout(() => { if (fillFromBanner(pasteInput.value)) pasteInput.value = ""; }, 0);
  });
  $("#pasteFill").addEventListener("click", () => {
    if (!pasteInput.value.trim()) { setPasteStatus("Paste the patient banner in the box first.", "err"); pasteInput.focus(); return; }
    if (fillFromBanner(pasteInput.value)) pasteInput.value = "";
  });
  pasteInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("#pasteFill").click(); }
  });
  // ⌘/Ctrl+V anywhere on the page (outside a text field) with a banner in the clipboard also works
  document.addEventListener("paste", (ev) => {
    if (ev.target.closest && ev.target.closest("input, textarea, select, [contenteditable]")) return;
    const text = ev.clipboardData && ev.clipboardData.getData("text");
    if (text && GDFParse.looksLikeBanner(text)) {
      ev.preventDefault();
      fillFromBanner(text);
    }
  });

  // ---------- preview ----------
  let previewUrl = null;
  let previewSeq = 0;

  async function showPreview(id) {
    state.previewId = id;
    renderTable();
    const e = byId.get(id);
    $("#previewName").textContent = e.title;
    $("#previewName").classList.remove("muted");
    const seq = ++previewSeq;
    try {
      const p = readPatient();
      const stamp = $("#stampPreview").checked && hasPatient(p);
      // always go through buildPdf so the preview gets the same form repairs as the printout
      const bytes = await GDFPdf.buildPdf([e], stamp ? p : null, { title: e.title });
      if (seq !== previewSeq) return;
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      $("#previewFrame").src = url + "#view=FitH&navpanes=0";
      $("#previewPlaceholder").hidden = true;
      if (previewUrl) setTimeout(((u) => () => URL.revokeObjectURL(u))(previewUrl), 2000);
      previewUrl = url;
    } catch (err) {
      if (seq !== previewSeq) return;
      showLoadError(err);
      $("#previewFrame").removeAttribute("src");
      $("#previewPlaceholder").hidden = false;
      $("#previewPlaceholder").querySelector("span").textContent = "Could not load this document";
    }
  }
  $("#stampPreview").addEventListener("change", () => { if (state.previewId != null) showPreview(state.previewId); });

  // ---------- print / download ----------
  function setStatus(msg, kind = "") {
    const s = $("#status");
    s.textContent = msg;
    s.className = "status " + kind;
  }

  function outputName(p) {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const who = [p.lastName && p.lastName.toUpperCase(), p.firstName, p.mrn].filter(Boolean).join("_");
    return (who ? who + "_" : "") + "documents_" + date;
  }

  async function build() {
    const p = readPatient();
    const entries = state.queue.map((id) => byId.get(id));
    const title = hasPatient(p)
      ? `${[p.lastName.toUpperCase(), p.firstName].filter(Boolean).join(", ")}${p.mrn ? " – " + p.mrn : ""} – ${entries.length} document${entries.length > 1 ? "s" : ""}`
      : entries.map((e) => e.title).join(" + ");
    const bytes = await GDFPdf.buildPdf(entries, hasPatient(p) ? p : null, { title });
    return { bytes, name: outputName(p), patient: hasPatient(p), title };
  }

  /**
   * Show the PDF in the new tab inside a full-window frame (the same way the preview pane shows it),
   * rather than navigating the tab to the PDF itself. Chrome keeps the form fields editable this way.
   */
  function showPdfInWindow(w, url, title) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const d = w.document;
    d.open();
    d.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#525659}iframe{display:block;border:0;width:100%;height:100%}</style>
</head><body><iframe src="${url}" title="${esc(title)}"></iframe></body></html>`);
    d.close();
    // ⌘/Ctrl+P while the focus is outside the PDF → print the PDF, not this wrapper page
    d.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "p") {
        ev.preventDefault();
        try { d.querySelector("iframe").contentWindow.print(); } catch (e) { /* use the viewer's print button */ }
      }
    });
  }

  $("#printBtn").addEventListener("click", async () => {
    if (!state.queue.length) return;
    // open the tab synchronously (inside the click) so it isn't blocked as a pop-up
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<title>Preparing documents…</title><body style="font:15px system-ui;color:#555;display:grid;place-items:center;height:90vh">Preparing ${state.queue.length} document(s)…</body>`);
    }
    setStatus("Building PDF…");
    try {
      const { bytes, name, patient, title } = await build();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      if (w && !w.closed) {
        showPdfInWindow(w, url, title);
      } else {
        download(url, name + ".pdf");
      }
      setStatus(patient ? "Opened in a new tab" : "Opened in a new tab (no patient information)", patient ? "ok" : "warn");
      // the URL is kept alive (not revoked) so the new tab can still be reloaded
    } catch (err) {
      if (w) w.close();
      showLoadError(err);
    }
  });

  $("#downloadBtn").addEventListener("click", async () => {
    setStatus("Building PDF…");
    try {
      const { bytes, name } = await build();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      download(url, name + ".pdf");
      setStatus("Downloaded", "ok");
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    } catch (err) {
      showLoadError(err);
    }
  });

  function download(url, name) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- opened from disk (file://) ----------
  function showLoadError(err) {
    console.error(err);
    if (location.protocol === "file:") {
      $("#fileBanner").hidden = false;
      setStatus("Choose the docs folder first (see the yellow banner)", "err");
    } else {
      setStatus(err.message || String(err), "err");
    }
  }
  if (location.protocol === "file:") $("#fileBanner").hidden = false;
  $("#folderInput").addEventListener("change", (ev) => {
    const n = GDFPdf.addPickedFiles(ev.target.files);
    if (n) {
      $("#fileBanner").hidden = true;
      setStatus(`Loaded ${n} PDF${n > 1 ? "s" : ""} from the folder`, "ok");
      state.queue.forEach((id) => pages.delete(id));
      renderQueue();
      if (state.previewId != null) showPreview(state.previewId);
    } else {
      setStatus("No PDF found in that folder", "err");
    }
  });

  // ---------- init ----------
  if (!catalog.length) {
    $("#emptyState").textContent = "No documents in docs/catalog.js yet.";
  }
  runSearch();
  renderQueue();
  updatePatientChip();
  // Pre-fetch page counts in the background (served over http only)
  if (location.protocol !== "file:") catalog.forEach((e) => loadPageCount(e.id));
})();
