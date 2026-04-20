"""Fix invalid UTF-8 in TSX files (latin-1 middle dot, broken multibyte)."""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

MIDDLE_DOT_UTF8 = "\u00b7".encode()


def fix_reservation_card_item(path: pathlib.Path) -> int:
    data = path.read_bytes()
    n = data.count(b"\xb7")
    fixed = data.replace(b"\xb7", MIDDLE_DOT_UTF8)
    if fixed != data:
        path.write_bytes(fixed)
    return n


def fix_admin_reservations_page(path: pathlib.Path) -> None:
    raw = path.read_bytes()
    text = raw.decode("utf-8", errors="replace")
    text = text.replace(
        "if (opt === '\ufffd\ufffd\ufffd?L') {",
        "if (opt === '\U0001f3dc\ufe0f L') {",
    )
    text = text.replace(
        "if (opt === '\ufffd\ufffd\ufffd?X') {",
        "if (opt === '\U0001f3dc\ufe0f X') {",
    )
    text = text.replace(
        "if (opt === '\ufffd\ufffd\ufffd?U') {",
        "if (opt === '\U0001f3dc\ufe0f U') {",
    )
    text = text.replace("if (opt === '?L') {", "if (opt === '\U0001f3dc\ufe0f L') {")
    text = text.replace("if (opt === '?X') {", "if (opt === '\U0001f3dc\ufe0f X') {")
    text = text.replace("if (opt === '?U') {", "if (opt === '\U0001f3dc\ufe0f U') {")

    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> int:
    rci = ROOT / "src/components/reservation/ReservationCardItem.tsx"
    page = ROOT / "src/app/[locale]/admin/reservations/page.tsx"

    n = fix_reservation_card_item(rci)
    print(f"ReservationCardItem: replaced {n} latin-1 middle-dot bytes")

    fix_admin_reservations_page(page)
    print("page.tsx: decoded with replace + fixed opt comparisons")

    page.read_text(encoding="utf-8")
    rci.read_text(encoding="utf-8")
    print("Strict UTF-8 OK for both files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
