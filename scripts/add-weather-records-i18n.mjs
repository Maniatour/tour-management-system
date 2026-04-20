import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const patches = [
  {
    file: "src/i18n/locales/ko.json",
    needle: `    "dataSync": "데이터 동기화",
    "dataReview": "데이터 검토",`,
    insert: `    "dataSync": "데이터 동기화",
    "weatherRecords": "날씨 기록",
    "dataReview": "데이터 검토",`,
  },
  {
    file: "src/i18n/locales/en.json",
    needle: `    "dataSync": "Data Sync",
    "dataReview": "Data Review",`,
    insert: `    "dataSync": "Data Sync",
    "weatherRecords": "Weather Records",
    "dataReview": "Data Review",`,
  },
];

for (const { file, needle, insert } of patches) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, "utf8");
  if (s.includes('"weatherRecords"')) {
    console.log("skip (already has weatherRecords):", file);
    continue;
  }
  if (!s.includes(needle)) {
    console.error("needle not found:", file);
    process.exit(1);
  }
  s = s.replace(needle, insert);
  fs.writeFileSync(p, s);
  console.log("patched:", file);
}
