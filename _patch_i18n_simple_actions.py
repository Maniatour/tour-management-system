from pathlib import Path

def patch(path: Path, old: str, new: str) -> None:
    t = path.read_text(encoding="utf-8")
    if "simpleActionsToggle" in t:
        print(path, "skip")
        return
    if old not in t:
        raise SystemExit(f"pattern not in {path}")
    path.write_text(t.replace(old, new, 1), encoding="utf-8")
    print(path, "ok")

root = Path(__file__).resolve().parent
patch(
    root / "src/i18n/locales/ko.json",
    '      "changeStatusModalTitle": "예약 상태 변경"\n    },',
    '      "changeStatusModalTitle": "예약 상태 변경",\n      "simpleActionsToggle": "버튼 영역 펼치기·접기"\n    },',
)
patch(
    root / "src/i18n/locales/en.json",
    '      "changeStatusModalTitle": "Change reservation status"\n    },',
    '      "changeStatusModalTitle": "Change reservation status",\n      "simpleActionsToggle": "Expand or collapse action buttons"\n    },',
)
