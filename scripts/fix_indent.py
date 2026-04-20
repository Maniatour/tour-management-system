from pathlib import Path
for f in ["src/i18n/locales/ko.json", "src/i18n/locales/en.json"]:
    p = Path(f)
    t = p.read_text(encoding="utf-8")
    t = t.replace('            "openTourInNewTab"', '      "openTourInNewTab"')
    p.write_text(t, encoding="utf-8")
    print("fixed", f)
