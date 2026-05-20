# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/components/expenses/CategoryMappingExpenseDetailDialog.tsx"
t = p.read_text(encoding="utf-8", errors="replace")

# Python \u escapes decode to proper Unicode when the script runs
R = [
    ("return '?? ??'\n    case 'reservation_expenses':\n      return '?? ??'",
     "return '\ud22c\uc5b4 \uc9c0\ucd9c'\n    case 'reservation_expenses':\n      return '\uc608\uc57d \uc9c0\ucd9c'"),
    ("case 'company_expenses':\n      return '?? ??'",
     "case 'company_expenses':\n      return '\ud68c\uc0ac \uc9c0\ucd9c'"),
    ("? '???? (category)' : '???? (paid_for)'",
     "? '\uce74\ud14c\uace0\ub9ac (category)' : '\acb0\uc81c\ub0b4\uc6a9 (paid_for)'"),
    ("const LEAF_PLACEHOLDER = '?? ?? ???'",
     "const LEAF_PLACEHOLDER = '\ud45c\uc900 \ub9ac\ud504 \uc120\ud0dd\u2026'"),
    ("?? ?? ? {originalValue}", "\uc9c0\ucd9c \uc0c1\uc138 \u2014 {originalValue}"),
    ("} \ufffd {lines.length}? \ufffd {formatMoney", "} \u00b7 {lines.length}\uac74 \u00b7 {formatMoney"),
    ("} ? {lines.length}? ? {formatMoney", "} \u00b7 {lines.length}\uac74 \u00b7 {formatMoney"),
    ("?? ??(?: vehicle)?? ?? ??? ???? ???",
     "\uac19\uc740 \uc6d0\ubb38(\uc608: vehicle)\uc73c\ub85c \ubb36\uc778 \uc9c0\ucd9c\uc744 \ub098\ub204\ub824\uba74 \ud589\ub9c8\ub2e4"),
    ("</strong>? ???? ?? ????? ??? ?\n            ?????. (vehicle loan, vehicle insurance ?)",
     "</strong>\uc744 \uad6c\ubd84\ud558\uace0 \ud45c\uc900 \uce74\ud14c\uace0\ub9ac\ub97c \uc9c0\uc815\ud55c \ub4a4 \uc800\uc7a5\ud558\uc138\uc694. (vehicle loan, vehicle insurance \ub4f1)"),
    ('">?? ??</span>', '">\uc77c\uad04 \uc791\uc5c5</span>'),
    ("?? {selectedCount}? / ?? {lines.length}?", "\uc120\ud0dd {selectedCount}\uac74 / \uc804\uccb4 {lines.length}\uac74"),
    (">?? ??\n              </Button>", ">\uc804\uccb4 \uc120\ud0dd\n              </Button>"),
    (">?? ??\n              </Button>\n              <Button\n                type=\"button\"\n                variant=\"ghost\"\n                size=\"sm\"\n                className=\"h-7 px-2 text-xs\"\n                disabled={busy || selectedCount === 0}",
     ">\uc120\ud0dd \ud574\uc81c\n              </Button>\n              <Button\n                type=\"button\"\n                variant=\"ghost\"\n                size=\"sm\"\n                className=\"h-7 px-2 text-xs\"\n                disabled={busy || selectedCount === 0}"),
    (">?? {classificationFieldLabel(sourceTable)}", ">\uc77c\uad04 {classificationFieldLabel(sourceTable)}"),
    (">?? ?? ????</Label>", ">\uc77c\uad04 \ud45c\uc900 \uce74\ud14c\uace0\ub9ac</Label>"),
    (">?? ??? ??", ">\uc120\ud0dd \ud56d\ubaa9\uc5d0 \uc801\uc6a9"),
    ("?? ??\n                  </>", "\uc800\uc7a5 \uc911\u2026\n                  </>"),
    ("`?? ${selectedCount}? ??`", "`\uc120\ud0dd ${selectedCount}\uac74 \uc800\uc7a5`"),
    (">???? ??", ">\ubd88\ub7ec\uc624\ub294 \uc911\u2026"),
    (">?? ??? ??? ????.</p>", ">\ud574\ub2f9 \uc6d0\ubb38\uc758 \uc9c0\ucd9c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</p>"),
    ('aria-label="?? ??? ?? ??"', 'aria-label="\ud604\uc7ac \ud398\uc774\uc9c0 \uc804\uccb4 \uc120\ud0dd"'),
    (">???</th>", ">\uc9c0\ucd9c\uc77c</th>", 1),
    (">???</th>", ">\uacb0\uc81c\ucc98</th>", 1),
    (">??</th>", ">\uc124\uba85</th>"),
    (">?? ????</th>", ">\ud45c\uc900 \uce74\ud14c\uace0\ub9ac</th>"),
    (">??</th>", ">\uae08\uc561</th>"),
    ('aria-label="? ??"', 'aria-label="\ud589 \uc120\ud0dd"'),
    ("{saving ? '?' : '??'}", "{saving ? '\u2026' : '\uc800\uc7a5'}"),
    ("|| '?'", f"|| '{chr(0x2014)}'"),
    (":\n                              '?'\n", f":\n                              '{chr(0x2014)}'\n"),
]

# Error/toast strings
ERR = [
    ("}? ?????.`", "}\uc744 \uc785\ub825\ud558\uc138\uc694.`"),
    ("'?? ????? ?????.'", "'\ud45c\uc900 \uce74\ud14c\uace0\ub9ac\ub97c \uc120\ud0dd\ud558\uc138\uc694.'"),
    ("|| '?? ?? ?? ??'", "|| '\uc608\uc57d \uc9c0\ucd9c \uc218\uc815 \uc2e4\ud328'"),
    ("|| '?? ?? ?? ??'", "|| '\ud68c\uc0ac \uc9c0\ucd9c \uc218\uc815 \uc2e4\ud328'"),
    (": '?? ??? ???? ?????.'", ":\n        '\uc9c0\ucd9c \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.'"),
    ("'??? ??? ????.')", "'\uc120\ud0dd\ub41c \ud56d\ubaa9\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.')"),
    ("'?? ?? ?? ?? ????? ?????.')", "'\uc77c\uad04 \uc6d0\ubb38 \ub610\ub294 \ud45c\uc900 \uce74\ud14c\uace0\ub9ac\ub97c \uc785\ub825\ud558\uc138\uc694.')"),
    ("`${selectedIds.size}?? ?? ??????. ?? ???? ?????.`",
     "`${selectedIds.size}\uac74\uc5d0 \uc77c\uad04 \uc801\uc6a9\ud588\uc2b5\ub2c8\ub2e4. \uc800\uc7a5 \ubc84\ud2bc\uc73c\ub85c \ubc18\uc601\ud558\uc138\uc694.`"),
    ("'??????.'", "'\uc800\uc7a5\ud588\uc2b5\ub2c8\ub2e4.'"),
    ("'??? ??????.')", "'\uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.'"),
    ("'?? ??'", "'\uc800\uc7a5 \uc2e4\ud328'"),
    ("`${ok}? ??????.${fail > 0 ? ` (${fail}? ??)` : ''}`",
     "`${ok}\uac74 \uc800\uc7a5\ud588\uc2b5\ub2c8\ub2e4.${fail > 0 ? ` (${fail}\uac74 \uc2e4\ud328)` : ''}`"),
]

for item in R + ERR:
    count = -1
    if len(item) == 3:
        old, new, count = item
    else:
        old, new = item
    if old not in t:
        print("skip (not found):", repr(old[:50]))
        continue
    t = t.replace(old, new, count)

p.write_text(t, encoding="utf-8")
print("written", p)
