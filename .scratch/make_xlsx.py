import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

wb = openpyxl.Workbook()

# ===== Sheet 1: thieu toa do =====
ws1 = wb.active
ws1.title = "Can bo sung toa do"
headers = ["Ten dia diem", "Danh muc", "Lat", "Lng", "Ghi chu"]
for col, h in enumerate(headers, start=1):
    c = ws1.cell(row=1, column=col, value=h)
    c.font = Font(name="Arial", bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="00458C")

ws1.cell(row=2, column=1, value="(Vi du) Toa A")
ws1.cell(row=2, column=2, value="Toa nha & Giang duong")
ws1.cell(row=2, column=3, value=10.732006)
ws1.cell(row=2, column=4, value=106.698795)
ws1.cell(row=2, column=5, value="Moi dong = 1 diem goc cua khu vuc, cung ten lap lai")
for col in range(1, 6):
    ws1.cell(row=2, column=col).font = Font(name="Arial", italic=True, color="808080")

places = [
    ("Khu golf", "Khu the thao"),
    ("Phong Gym", "Khu the thao"),
    ("San pickleball", "Khu the thao"),
    ("Truong Quoc te Viet Nam - Phan Lan (VFIS)", "Truong truc thuoc"),
]
row = 4
for name, cat in places:
    for i in range(6):
        ws1.cell(row=row, column=1, value=name if i == 0 else "")
        ws1.cell(row=row, column=2, value=cat if i == 0 else "")
        ws1.cell(row=row, column=1).font = Font(name="Arial")
        row += 1
    row += 1

for col, w in zip("ABCDE", [40, 24, 14, 14, 45]):
    ws1.column_dimensions[col].width = w

# ===== Sheet 2: overlap review =====
ws2 = wb.create_sheet("Can xem lai (chong nhau)")
headers2 = ["Khu vuc 1", "Khu vuc 2", "Ghi chu / Trang thai"]
for col, h in enumerate(headers2, start=1):
    c = ws2.cell(row=1, column=col, value=h)
    c.font = Font(name="Arial", bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="D32F2F")

overlaps = [
    ("Toa K", "San quoc phong"),
    ("Toa K", "San bong ro 2"),
    ("San quoc phong", "Ho boi 2"),
    ("Khu tap the duc KTX 1", "San tennis"),
    ("Ho boi 2", "Khu tap the duc KTX 2"),
    ("San tennis", "San bong ro 1"),
    ("Toa M", "Trung tam QPAN (co the hop ly, Toa M truc thuoc QPAN)"),
]
for i, (a, b) in enumerate(overlaps, start=2):
    ws2.cell(row=i, column=1, value=a).font = Font(name="Arial")
    ws2.cell(row=i, column=2, value=b).font = Font(name="Arial")

for col, w in zip("ABC", [28, 45, 40]):
    ws2.column_dimensions[col].width = w

wb.save("tdtu_coverage_update.xlsx")
print("saved")
