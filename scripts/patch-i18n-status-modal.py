from pathlib import Path

root = Path(__file__).resolve().parent.parent

# en.json
en = root / "src/i18n/locales/en.json"
text = en.read_text(encoding="utf-8")
needle = '      "reservationOptionsShort": "Options"\n    },\n    "paginationDisplay"'
if needle not in text:
    needle = '      "reservationOptionsShort": "Options"\r\n    },\r\n    "paginationDisplay"'
repl = '      "reservationOptionsShort": "Options",\n      "changeStatusModalTitle": "Change reservation status"\n    },\n    "paginationDisplay"'
if "\r\n" in needle:
    repl = repl.replace("\n", "\r\n")
if needle not in text:
    raise SystemExit("en: pattern not found")
en.write_text(text.replace(needle, repl, 1), encoding="utf-8")
print("en: ok")

# ko.json
ko = root / "src/i18n/locales/ko.json"
text = ko.read_text(encoding="utf-8")
needle = '      "close": "닫기"\n    },\n    "paginationDisplay"'
if needle not in text:
    needle = '      "close": "닫기"\r\n    },\r\n    "paginationDisplay"'
repl = '      "close": "닫기",\n      "changeStatusModalTitle": "예약 상태 변경"\n    },\n    "paginationDisplay"'
if "\r\n" in needle:
    repl = repl.replace("\n", "\r\n")
if needle not in text:
    raise SystemExit("ko: pattern not found")
ko.write_text(text.replace(needle, repl, 1), encoding="utf-8")
print("ko: ok")
