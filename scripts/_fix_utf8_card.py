# One-off: fix invalid UTF-8 in ReservationCardItem.tsx
import pathlib

root = pathlib.Path(__file__).resolve().parents[1]
path = root / "src" / "components" / "reservation" / "ReservationCardItem.tsx"
data = bytearray(path.read_bytes())

needle = b'text-gray-400">\xb7</span>'
repl = b'text-gray-400">\xc2\xb7</span>'
if needle in data:
    data = data.replace(needle, repl, 1)
    print("fixed span middle dot")
else:
    print("span needle missing")

path.write_bytes(data)
path.read_bytes().decode("utf-8")
print("UTF-8 OK")
