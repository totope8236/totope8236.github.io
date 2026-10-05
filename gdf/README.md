# GDF – hospital documents

Search the hospital forms in `docs/`, tick the ones you need, enter the patient once, and open
all of them as **one PDF** with the patient's identification stamped in the top-right corner of every page.
The PDF opens in a new tab in the browser's own PDF viewer, so you can fill in the fields and print.

Everything runs in the browser. No patient information is saved, and nothing is sent anywhere.
Reloading the page clears it.

## Opening the site

- **GitHub Pages / any web server**: open `…/gdf/` and it works as is.
- **Locally**: from the `gdf` folder run `python3 -m http.server 8000`, then open <http://localhost:8000>.
- **Double-clicking `index.html`** also works, but browsers block pages opened from disk from reading files.
  A yellow banner asks you to pick the `gdf/docs` folder once per visit.

## Using it

1. Enter the patient, or **paste the patient banner** from the hospital system into the box at the top of the
   Patient pane (or press ⌘V anywhere outside a text field). It fills MRN, DOB, sex, name, RAMQ, RAMQ expiry,
   address, city, province, postal code and site, after clearing the previous patient. The phone isn't in the
   banner, so add it by hand if you need it. The street and city aren't separated in the banner: the city is taken
   to be the last word (multi-word city names are listed in `js/parse.js`). Check the fields after pasting.
   - Typing the RAMQ number fills in the date of birth and sex if they're empty, and warns you if they don't match.
   - RAMQ, its expiry (`2705` → `2027-05`), postal code and phone are formatted when you leave the field.
2. Search by title, form number (`DT9003`, `AH-515`) or tag (`coro`, `NIM`, `ICD`…). Matching is partial and
   ignores accents. Click a tag to search for it.
3. Click a row to preview it (with the patient stamp, unless you untick *Show patient stamp*).
4. Tick the documents you need. The **print queue** keeps them in the order you ticked them, and you can drag them or use ↑/↓ to reorder.
5. Click **Open for printing** to open the combined PDF in a new tab, or **Download PDF** to save it as a file.

Keyboard: `/` jumps to search, `↑`/`↓` move through the results, `Enter` previews, `Ctrl/⌘+Enter` ticks.

## Adding documents

1. Copy the PDF into `docs/`.
2. Run `python3 tools/update_catalog.py`. It adds a starter entry to `docs/catalog.js` for each new PDF.
3. In `docs/catalog.js`, fix the entry's `title` and add `tags` (synonyms, abbreviations, English terms, anything you might type to find it).
4. For MUHC forms, add `stamp: MUHC_ORDERS_LABEL` (order sheets on the DM-6225 template) or `stamp: MUHC_CONSULT_LABEL`
   (consultation DM-3451) so the label lands in the right spot. Without a `stamp`, the label goes in the ID box of the
   Québec (MSSS) forms.

File names: lowercase, no spaces, e.g. `demande_…_dt9003.pdf` (MSSS forms), `ordo_….pdf` (MUHC pre-printed orders),
`…_dm3451.pdf` (other MUHC forms).

## Files

| File | Purpose |
|---|---|
| `index.html`, `css/style.css` | Page layout |
| `js/app.js` | Search, table, print queue, patient form, preview |
| `js/parse.js` | Reads the pasted patient banner |
| `js/stamp.js` | **What the patient stamp contains and where it goes.** Edit this to change the layout |
| `js/pdf.js` | Loads, stamps and merges the PDFs; keeps fillable fields working after merging |
| `js/formfix.js` | Repairs forms damaged by re-saving in macOS Preview (see below) |
| `docs/catalog.js` | List of documents (title, form number, tags, optional per-document stamp settings) |
| `lib/pdf-lib.min.js` | [pdf-lib](https://pdf-lib.js.org) 1.17.1 (MIT), included locally so nothing loads from the internet |
| `tools/update_catalog.py` | Adds new PDFs from `docs/` to the catalog |

### Notes on the stamp

The stamp copies the MUHC addressograph label (measured on a scanned order sheet):

```
MRN  SEX  YYYY-MM-DD  RAMQ  YYMM  SITE
LAST FIRST
NUMBER STREET
CITY PROV  POSTALCODE  PHONE
  ||||||| Code 39 barcode of the MRN |||||||
```

- Helvetica 9 pt, capitals without accents. The city is cut at 12 letters, as the label printer does.
- The barcode has the same bar sizes as the real label (narrow bar 0.595 pt, wide 2.5×, 17 pt high), so a
  6-digit MRN gives a 24 mm-wide barcode. Its size never changes.
- The real label is ~236 pt wide and the box on the Québec forms is 228 pt. `fitToBox: true` narrows the
  *text* slightly (~6%) so it stays inside the box. Set it to `false` in `js/stamp.js` to print the text at full width.
- All measurements are in the `LABEL` object in `js/stamp.js`. Where the label goes is set by `DEFAULT_STAMP`, or per
  document in `catalog.js`, e.g. `stamp: { pages: [1], box: { x: 342, y: 42, w: 228, h: 120 } }` (points, from the
  top-left corner).
- Annotations sitting over the stamp area are drawn into the page first so they don't cover the label (e.g. the
  white rectangles drawn over the ID box in the current PDFs). Fillable fields are left alone.

### Fillable fields and macOS Preview

Re-saving a fillable PDF in macOS Preview (e.g. after drawing a box on it) damages its form. Field names are replaced
by `button745`, `text0`… or removed, and radio groups are split into separate buttons. Worst of all, the checkboxes
that are meant to be mutually exclusive end up **resetting the whole form** when clicked. In a merged PDF, that means
every document.

`js/formfix.js` repairs this automatically when a PDF is loaded:

- reset actions are rebuilt so a checkbox only unticks its siblings, as originally intended
- radio groups are rebuilt (or turned into checkboxes when that can't be done safely)
- nameless fields get a name so they can be filled again

It's still best to put the original, unmodified PDFs in `docs/` and not re-save them in Preview. Any value saved
in a PDF (e.g. a box that was ticked before saving) shows up in every printout.
