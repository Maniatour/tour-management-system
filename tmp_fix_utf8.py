path = r"c:\Users\Chad-Office\tour-management-system\src\components\reservation\ReservationCardItem.tsx"
with open(path, "rb") as f:
    data = f.read()
orig = data
data = data.replace(b'gray-300">\x9d</span>', b'gray-300">\xc2\xb7</span>')
data = data.replace(b'gray-400">\x9d</span>', b'gray-400">\xc2\xb7</span>')
if data == orig:
    print("NO CHANGE - pattern mismatch")
    raise SystemExit(1)
with open(path, "wb") as f:
    f.write(data)
data.decode("utf-8")
print("fixed, utf-8 ok")
