# -*- coding: utf-8 -*-
path = "src/i18n/locales/ko.json"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
old = '    "dataSync": "데이터 동기화",\n    "dataReview":'
new = '    "dataSync": "데이터 동기화",\n    "weatherRecords": "기상 기록",\n    "dataReview":'
if old not in text:
    raise SystemExit("pattern not found")
if '"weatherRecords"' in text[:2000]:
    print("skip: weatherRecords may already exist near top")
else:
    text = text.replace(old, new, 1)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("patched")
