#!/usr/bin/env python3
"""
Add any PDF found in gdf/docs/ that is not yet listed in gdf/docs/catalog.js.

    python3 tools/update_catalog.py

New entries get a title guessed from the file name and an empty tag list;
edit docs/catalog.js afterwards to give them a proper title and tags.
Existing entries are never modified.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CATALOG = DOCS / "catalog.js"


def guess(file_name: str) -> dict:
    stem = Path(file_name).stem
    m = re.search(r"(?<![a-z0-9])(dt\d{3,5})(?![0-9])", stem, re.I)
    code = m.group(1).upper() if m else ""
    if m:
        stem = stem[: m.start()] + stem[m.end():]
    title = re.sub(r"[_\-\s]+", " ", stem).strip()
    return {"file": file_name, "title": title[:1].upper() + title[1:], "code": code, "tags": []}


def main() -> None:
    text = CATALOG.read_text(encoding="utf-8")
    listed = set(re.findall(r"""file:\s*["']([^"']+)["']""", text))
    pdfs = sorted(p.name for p in DOCS.glob("*.pdf"))
    missing = [f for f in pdfs if f not in listed]
    gone = sorted(listed - set(pdfs))

    if missing:
        blocks = []
        for f in missing:
            e = guess(f)
            blocks.append(
                "  {\n"
                f"    file: {json.dumps(e['file'], ensure_ascii=False)},\n"
                f"    title: {json.dumps(e['title'], ensure_ascii=False)},\n"
                f"    code: {json.dumps(e['code'])},\n"
                "    tags: [],\n"
                "  },\n"
            )
        end = text.rstrip().rfind("];")
        if end == -1:
            raise SystemExit("Could not find the end of the GDF_CATALOG list ( ]; ) in catalog.js")
        text = text[:end] + "".join(blocks) + text[end:]
        CATALOG.write_text(text, encoding="utf-8")
        print(f"Added {len(missing)} document(s):")
        for f in missing:
            print("  +", f)
        print("Edit docs/catalog.js to set their titles and tags.")
    else:
        print("catalog.js already lists every PDF in docs/.")

    if gone:
        print("\nListed in catalog.js but not found in docs/ (remove or fix these entries):")
        for f in gone:
            print("  ?", f)


if __name__ == "__main__":
    main()
