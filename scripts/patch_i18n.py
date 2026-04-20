from pathlib import Path
for name in ["ko", "en"]:
    p = Path(f"src/i18n/locales/{name}.json")
    text = p.read_text(encoding="utf-8")
    if name == "ko":
        ins = '''      "openTourInNewTab": "새 탭에서 열기",
      "reservationOptionsModalTitle": "예약 옵션",
      "reservationOptionsIconTitle": "예약 옵션 추가·수정·삭제",
      "reservationOptionsShort": "예약 옵션"'''
    else:
        ins = '''      "openTourInNewTab": "Open in new tab",
      "reservationOptionsModalTitle": "Reservation options",
      "reservationOptionsIconTitle": "Add, edit, or delete reservation options",
      "reservationOptionsShort": "Options"'''
    old = '"openTourInNewTab": "새 탭에서 열기"' if name == "ko" else '"openTourInNewTab": "Open in new tab"'
    if ins.split(",")[0] + "," not in text:
        pass
    new = ins
    assert old in text, name
    text = text.replace(old, new, 1)
    p.write_text(text, encoding="utf-8")
    print(name, "i18n ok")
