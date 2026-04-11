# -*- coding: utf-8 -*-
p = r"src/app/api/payment-records/route.ts"
with open(p, encoding="utf-8") as f:
    lines = f.read().splitlines(keepends=True)

start = None
for i, ln in enumerate(lines):
    if ln.strip() == "// 필수 필드 검증":
        start = i
        break
if start is None:
    raise SystemExit("validation comment not found")

new_block = """    const parsedAmount =
      amount !== null && amount !== undefined && amount !== ''
        ? parseFloat(String(amount))
        : Number.NaN
    // 필수 필드 검� 0 이하는 입금 레코드로 생성하지 않음)
    if (
      !reservation_id ||
      payment_method == null ||
      String(payment_method).trim() === '' ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return NextResponse.json(
        { error: '��수 필�������이 유���하지 않습니다' },
        { status: 400 }
      )
    }

"""

# Replace 4 lines: comment, if, return, }
lines[start : start + 4] = [new_block]

with open(p, "w", encoding="utf-8") as f:
    f.writelines(lines)
print("payment-records route patched")
