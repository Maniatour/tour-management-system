"""Remove broken fragments left after stripping console.log lines from page.tsx."""
import re
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "src/app/[locale]/admin/reservations/page.tsx"
s = p.read_text(encoding="utf-8")

s, n1 = re.subn(
    r"(\n    const reservationId = \(reservation as any\)\.id \|\| newReservationId)\n\n      reservationId,\n(?:      .+\n)+?    \}\)\n",
    r"\1\n",
    s,
    count=1,
)

s, n2 = re.subn(
    r"\n      \}\n\n      \n        hasChoices:[\s\S]*?\n      \}\)\n\n      // reservation_customers",
    r"\n      }\n\n      // reservation_customers",
    s,
    count=1,
)

s, n3 = re.subn(
    r"(if \(rcError\) \{\n              console\.error\('Error saving reservation_customers:', rcError\)\n            \}) else \{\n            \}",
    r"\1",
    s,
    count=1,
)

s, n4 = re.subn(
    r"if \(tourResult\.success && tourResult\.tourId\) \{\n          \} else \{\n            console\.warn\('Tour creation failed:', tourResult\.message\)\n          \}",
    r"if (!tourResult.success || !tourResult.tourId) {\n            console.warn('Tour creation failed:', tourResult.message)\n          }",
    s,
    count=1,
)

s, n5 = re.subn(
    r"\n      // [\s\S]*?reservation_choices[\s\S]*?\n        reservationId,\n        hasChoices:[\s\S]*?selectedChoices: \(reservation as any\)\.selectedChoices\n      \}\)\n\n      if \(reservationId\) \{\n        try \{\n          const UNDECIDED_OPTION_ID",
    r"\n      // Save choices to reservation_choices from selectedChoices or choices.required\n      if (reservationId) {\n        try {\n          const UNDECIDED_OPTION_ID",
    s,
    count=1,
)

s, n6 = re.subn(
    r"(const selectedChoices = \(reservation as any\)\.selectedChoices)\n              isArray:[\s\S]*?value: selectedChoices\n            \}\)\n\n            if \(Array\.isArray\(selectedChoices\)",
    r"\1\n\n            if (Array.isArray(selectedChoices)",
    s,
    count=1,
)

s, n7 = re.subn(
    r"(alert\(t\('messages\.choicesSaveError'\) \+ choicesError\.message\)\n            \}) else \{\n            \}\n          \} else \{",
    r"\1\n          } else {",
    s,
    count=1,
)

s, n8 = re.subn(
    r"\n      // reservation_pricing[\s\S]*?\n        reservationId,\n        hasPricingInfo:[\s\S]*?pricingInfoKeys:[^\n]+\n      \}\)\n\n      if \(reservationId\) \{\n        // pricingInfo",
    r"\n      // Auto-create reservation_pricing row\n      if (reservationId) {\n        // pricingInfo",
    s,
    count=1,
)

s, n9 = re.subn(
    r"(alert\(t\('messages\.pricingSaveError'\) \+ pricingError\.message\)\n          \}) else \{\n          \}\n        \} catch \(pricingError\)",
    r"\1\n        } catch (pricingError)",
    s,
    count=1,
)

s, n10 = re.subn(
    r"(console\.error\('payment_records[^\n]+\n              \}) else \{\n              \}\n            \}\n          \}\n        \} catch \(paymentError\)",
    r"\1\n            }\n          }\n        } catch (paymentError)",
    s,
    count=1,
)

p.write_text(s, encoding="utf-8", newline="\n")
print(
    "replacements:",
    {
        "orphan_reservationId": n1,
        "orphan_after_error": n2,
        "rc_else": n3,
        "tour_if": n4,
        "choices_orphan": n5,
        "selectedChoices": n6,
        "choices_empty_else": n7,
        "pricing_orphan": n8,
        "pricing_empty_else": n9,
        "payment_empty_else": n10,
    },
)
