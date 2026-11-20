import openpyxl
from openpyxl.styles import Font, PatternFill

wb = openpyxl.Workbook()

# ===== Sheet 1: Tang-Phong (day du) =====
ws1 = wb.active
ws1.title = "Tang-Phong"
headers = ["Tang", "Ma", "Ten", "Chuc nang"]
for col, h in enumerate(headers, start=1):
    c = ws1.cell(row=1, column=col, value=h)
    c.font = Font(name="Arial", bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="00458C")

row = 2
floor0 = [
    ("VP_K", "Van phong toa K", "Phong hanh chinh"),
    ("PG", "Phong giat", "Phong chuc nang"),
    ("SM", "Smart", "Mua sam"),
    ("TM-G", "Thang may", "Thang may"),
    ("TB-G", "Thang bo", "Thang bo"),
    ("NVS-G", "NVS", "Ve sinh"),
]
for code, name, func in floor0:
    ws1.cell(row=row, column=1, value="0 (Tret)")
    ws1.cell(row=row, column=2, value=code)
    ws1.cell(row=row, column=3, value=name)
    ws1.cell(row=row, column=4, value=func)
    row += 1

for level in range(1, 19):
    lvl = str(level).zfill(2)
    entries = [("TB1-" + lvl, "Thang bo", "Thang bo")]
    for n in [1,2,3,4,5,6,7,8]:
        entries.append((f"K{lvl}{str(n).zfill(2)}", None, "Phong o"))
    entries.append(("TM-" + lvl, "Thang may", "Thang may"))
    entries.append(("TB2-" + lvl, "Thang bo", "Thang bo"))
    for n in [14,13,12,11,10,9]:
        entries.append((f"K{lvl}{str(n).zfill(2)}", None, "Phong o"))
    entries.append((f"K{lvl}15", "Phong dien", "Phong chuc nang"))
    entries.append((f"K{lvl}16", "Phong dien", "Phong chuc nang"))
    for code, name, func in entries:
        ws1.cell(row=row, column=1, value=level)
        ws1.cell(row=row, column=2, value=code)
        ws1.cell(row=row, column=3, value=name)
        ws1.cell(row=row, column=4, value=func)
        row += 1

for col, w in zip("ABCD", [12, 14, 24, 18]):
    ws1.column_dimensions[col].width = w

# ===== Sheet 2: So do (day du 18 tang) =====
ws2 = wb.create_sheet("So do")
r = 1
def hdr(ws, row, text):
    c = ws.cell(row=row, column=1, value=text)
    c.font = Font(name="Arial", bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="D32F2F")

hdr(ws2, r, "Tang tret"); r += 1
ws2.append(["Smart", None, None, "Sanh K", None, "Van phong toa K", None, "Phong giat", None]); r += 1
ws2.append([None, None, None, None, "Thang may", "Thang bo", "NVS", None, None]); r += 1
r += 1

for level in range(1, 19):
    lvl = str(level).zfill(2)
    hdr(ws2, r, f"Tang {level}"); r += 1
    ws2.append(["Thang bo", f"K{lvl}01", f"K{lvl}02", f"K{lvl}03", f"K{lvl}04", f"K{lvl}05", f"K{lvl}06", f"K{lvl}07", f"K{lvl}08"]); r += 1
    ws2.append(["Hanh lang"]); r += 1
    ws2.append([f"K{lvl}15-K{lvl}16", f"K{lvl}14", f"K{lvl}13", f"K{lvl}12", "Thang may", "Thang bo", f"K{lvl}11", f"K{lvl}10", f"K{lvl}09"]); r += 1
    r += 1

for col, w in zip("ABCDEFGHI", [16]*9):
    ws2.column_dimensions[col].width = w

# ===== Sheet 3: Cua vao =====
ws3 = wb.create_sheet("Cua vao")
for coord in ["10.730784, 106.697722", "10.730939, 106.697738", "10.730768, 106.697636"]:
    ws3.append([coord])
ws3.column_dimensions["A"].width = 24

wb.save("toa_k_du_lieu_day_du.xlsx")
print("saved, total rows sheet1:", row-1)
