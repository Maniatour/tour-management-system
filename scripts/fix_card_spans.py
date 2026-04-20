from pathlib import Path

p = Path(__file__).resolve().parent.parent / "src/components/reservation/ReservationCardItem.tsx"
s = p.read_text(encoding="utf-8")
dot = "\u00b7"
s = s.replace('className="text-gray-300">\uFFFD</span>', f'className="text-gray-300">{dot}</span>')
s = s.replace('className="text-gray-400">\uFFFD</span>', f'className="text-gray-400">{dot}</span>')
p.write_text(s, encoding="utf-8", newline="\n")
print("updated", p)
