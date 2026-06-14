/**
 * 프로젝트 타입 오류를 디렉터리(배치) 단위로 검사합니다.
 *
 * Usage:
 *   node scripts/typecheck-batch.cjs              # 배치 목록 + 전체 요약
 *   node scripts/typecheck-batch.cjs utils        # src/utils 만
 *   node scripts/typecheck-batch.cjs types utils  # 여러 배치
 *   node scripts/typecheck-batch.cjs src/lib/foo.ts
 */
const ts = require("typescript");
const path = require("node:path");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
process.chdir(root);

/** @type {Record<string, (rel: string) => boolean>} */
const BATCHES = {
  types: (rel) => rel.startsWith("src/types/"),
  lib: (rel) => rel.startsWith("src/lib/"),
  utils: (rel) => rel.startsWith("src/utils/"),
  hooks: (rel) => rel.startsWith("src/hooks/"),
  components: (rel) => rel.startsWith("src/components/"),
  "app-pages": (rel) => rel.includes("/page.tsx") && rel.startsWith("src/app/"),
  "app-api": (rel) => rel.startsWith("src/app/api/"),
};

const MAX_ERRORS_PER_FILE = 8;

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function loadProgram() {
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
  const host = ts.createCompilerHost(parsed.options, true);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
    host,
  });
  return { program, parsed };
}

function diagnosticsForFile(program, sf) {
  const issues = [];
  for (const d of program.getSemanticDiagnostics(sf)) {
    if (!d.file || d.start === undefined) continue;
    if (d.file.fileName !== sf.fileName) continue;
    const pos = d.file.getLineAndCharacterOfPosition(d.start);
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    issues.push({ code: d.code, message: msg, line: pos.line + 1 });
  }
  return issues;
}

function matchBatch(batchName, fileRel) {
  if (BATCHES[batchName]) return BATCHES[batchName](fileRel);
  const abs = path.resolve(root, batchName);
  if (fs.existsSync(abs)) {
    const target = rel(abs);
    return fileRel === target || fileRel.startsWith(`${target}/`);
  }
  return fileRel.includes(batchName);
}

function listSourceFiles(program) {
  return program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile && !sf.fileName.includes("node_modules"))
    .filter((sf) => {
      const r = rel(sf.fileName);
      return r.startsWith("src/") && (r.endsWith(".ts") || r.endsWith(".tsx"));
    });
}

function summarizeBatch(program, sourceFiles, label) {
  /** @type {Map<string, { code: number; message: string; line: number }[]>} */
  const errorsByFile = new Map();
  for (const sf of sourceFiles) {
    const issues = diagnosticsForFile(program, sf);
    if (issues.length) errorsByFile.set(sf.fileName, issues);
  }
  const fileCount = sourceFiles.length;
  const errorCount = [...errorsByFile.values()].reduce((n, arr) => n + arr.length, 0);
  console.log(`\n=== ${label} ===`);
  console.log(`files: ${fileCount}, files with errors: ${errorsByFile.size}, errors: ${errorCount}`);
  if (errorsByFile.size === 0) {
    console.log("OK\n");
    return { fileCount, filesWithErrors: 0, errorCount: 0 };
  }
  const sorted = [...errorsByFile.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [file, issues] of sorted) {
    console.log(`\n${rel(file)} (${issues.length})`);
    for (const i of issues.slice(0, MAX_ERRORS_PER_FILE)) {
      console.log(`  L${i.line} TS${i.code}: ${i.message}`);
    }
    if (issues.length > MAX_ERRORS_PER_FILE) {
      console.log(`  ... +${issues.length - MAX_ERRORS_PER_FILE} more`);
    }
  }
  console.log("");
  return { fileCount, filesWithErrors: errorsByFile.size, errorCount };
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Typecheck batches (run: node scripts/typecheck-batch.cjs <name> ...):");
  for (const name of Object.keys(BATCHES)) {
    console.log(`  - ${name}`);
  }
  console.log("\nOr pass a path under src/, e.g. src/utils/tourStatusUtils.ts\n");
  console.log("[typecheck-batch] loading program...");
  const { program } = loadProgram();
  const all = listSourceFiles(program);
  const totals = summarizeBatch(program, all, "project-wide (src/**)");
  process.exit(totals.errorCount ? 1 : 0);
}

console.error("[typecheck-batch] loading program...");
const { program } = loadProgram();
const all = listSourceFiles(program);

let selected = all;
if (args.length === 1) {
  selected = all.filter((sf) => matchBatch(args[0], rel(sf.fileName)));
} else {
  selected = all.filter((sf) => {
    const r = rel(sf.fileName);
    return args.some((arg) => matchBatch(arg, r));
  });
}

if (selected.length === 0) {
  console.error(`No source files matched: ${args.join(", ")}`);
  process.exit(1);
}

const label = args.join(" + ");
const totals = summarizeBatch(program, selected, label);
process.exit(totals.errorCount ? 1 : 0);
