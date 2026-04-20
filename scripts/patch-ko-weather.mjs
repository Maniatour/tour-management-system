import fs from "fs";

const p = "src/i18n/locales/ko.json";
let t = fs.readFileSync(p, "utf8");
const oldStr =
  '    "dataSync": "\uB370\uC774\uD130 \uB3D9\uAE30\uD654",\n    "dataReview":';
const newStr =
  '    "dataSync": "\uB370\uC774\uD130 \uB3D9\uAE30\uD654",\n    "weatherRecords": "\uAE30\uC0C1 \uAE30\uB85D",\n    "dataReview":';
if (!t.includes(oldStr)) {
  console.error("pattern not found");
  process.exit(1);
}
if (t.slice(0, 2500).includes('"weatherRecords"')) {
  console.log("skip: already present in sidebar");
} else {
  t = t.replace(oldStr, newStr);
  fs.writeFileSync(p, t, "utf8");
  console.log("patched");
}
