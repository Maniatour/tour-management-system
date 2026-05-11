/**
 * createProgram 1회 후, 각 page.tsx에 대해 getSemanticDiagnostics만 호출해
 * 오래 걸리는 페이지와 해당 파일의 타입 오류를 출력합니다.
 */
const ts = require("typescript");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
process.chdir(root);

const SLOW_MS = 8000;

const configPath = ts.findConfigFile(root, ts.sys.readFile.bind(ts.sys), "tsconfig.json");
if (!configPath) {
  console.error("tsconfig.json not found");
  process.exit(1);
}

const readResult = ts.readConfigFile(configPath, ts.sys.readFile.bind(ts.sys));
if (readResult.error) {
  console.error(ts.flattenDiagnosticMessageText(readResult.error.messageText, "\n"));
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(
  readResult.config,
  ts.sys,
  path.dirname(configPath),
  undefined,
  configPath,
);

console.error(`[typecheck-pages] createProgram, files=${parsed.fileNames.length}`);
const tProgram = Date.now();
const host = ts.createCompilerHost(parsed.options, true);
const program = ts.createProgram({
  rootNames: parsed.fileNames,
  options: parsed.options,
  projectReferences: parsed.projectReferences,
  host,
});
console.error(`[typecheck-pages] createProgram done ${Date.now() - tProgram}ms`);

const rel = (f) => path.relative(root, f).replace(/\\/g, "/");

const pageFiles = program
  .getSourceFiles()
  .filter((sf) => !sf.isDeclarationFile && sf.fileName.replace(/\\/g, "/").endsWith("/page.tsx"))
  .sort((a, b) => a.fileName.localeCompare(b.fileName));

console.error(`[typecheck-pages] page.tsx count=${pageFiles.length}`);

/** @type {Map<string, { code: number; message: string; line: number }[]>} */
const errorsByPage = new Map();
/** @type {string[]} */
const slowPages = [];

for (const sf of pageFiles) {
  const t0 = Date.now();
  const diags = program.getSemanticDiagnostics(sf);
  const dt = Date.now() - t0;
  const r = rel(sf.fileName);
  if (dt >= SLOW_MS) {
    slowPages.push(`${r} (${dt}ms)`);
  }
  const issues = [];
  for (const d of diags) {
    if (!d.file || d.start === undefined) continue;
    if (d.file.fileName !== sf.fileName) continue;
    const pos = d.file.getLineAndCharacterOfPosition(d.start);
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    issues.push({ code: d.code, message: msg, line: pos.line + 1 });
  }
  if (issues.length) {
    errorsByPage.set(sf.fileName, issues);
  }
  if (dt >= 2000) {
    console.error(`[typecheck-pages] ${dt}ms\t${r}`);
  }
}

if (slowPages.length) {
  console.log("\n=== Slow page.tsx (semantic check >= " + SLOW_MS + "ms) ===\n");
  console.log(slowPages.join("\n"));
  console.log("");
}

if (errorsByPage.size === 0) {
  console.log("OK: no semantic diagnostics on page.tsx files\n");
  process.exit(0);
}

console.log("=== Type errors reported on page.tsx ===\n");
const sorted = [...errorsByPage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [file, issues] of sorted) {
  console.log(rel(file));
  for (const i of issues) {
    console.log(`  L${i.line} TS${i.code}: ${i.message}`);
  }
  console.log("");
}
process.exit(1);
