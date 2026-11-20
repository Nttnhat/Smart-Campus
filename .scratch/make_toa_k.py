import openpyxl
from openpyxl.styles import Font, PatternFill

wb = openpyxl.Workbook()

# ===== Sheet 1: Danh sach phong theo tang =====
ws1 = wb.active
ws1.title = "Phong theo tang"
headers = ["Tang (0=Tret)", "Ma phong", "Ten / cong nang", "Loai phong"]
for col, h in enumerate(headers, start=1):
    c = ws1.cell(row=1, column=col, value=h)
    c.font = Font(name="Arial", bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="00458C")

ws1.cell(row=2, column=1, value=1)
ws1.cell(row=2, column=2, value="K0101")
ws1.cell(row=2, column=3, value="Phong hoc")
ws1.cell(row=2, column=4, value="classroom")
for col in range(1, 5):
    ws1.cell(row=2, column=col).font = Font(name="Arial", italic=True, color="808080")
ws1.cell(row=3, column=3, value="(vi du - xoa dong nay, dien that tu day xuong)")
ws1.cell(row=3, column=3).font = Font(name="Arial", italic=True, color="808080")

ws1.cell(row=5, column=1, value="Loai phong hop le: classroom, lab, office, support, stairs, elevator, wc, corridor, other")
ws1.cell(row=5, column=1).font = Font(name="Arial", italic=True, size=9, color="808080")

for row in range(6, 6 + 19*3):
    pass  # de trong cho nguoi dung dien

for col, w in zip("ABCD", [16, 16, 36, 16]):
    ws1.column_dimensions[col].width = w

# ===== Sheet 2: So do bo tri theo hang (cho tung tang can ve layout) =====
ws2 = wb.create_sheet("So do bo tri (hang)")
headers2 = ["Tang", "So thu tu hang", "Thu tu trai->phai (cach nhau boi dau phay)"]
for col, h in enumerate(headers2, start=1):
    c = ws2.cell(row=1, column=col, value=h)
    c.font = Font(name="Arial", bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="D32F2F")

ws2.cell(row=2, column=1, value=1)
ws2.cell(row=2, column=2, value=1)
ws2.cell(row=2, column=3, value="K0101, K0102, Hanh lang, K0103, K0104")
ws2.cell(row=3, column=1, value=1)
ws2.cell(row=3, column=2, value=2)
ws2.cell(row=3, column=3, value="Hanh lang")
for r in [2,3]:
    for col in range(1,4):
        ws2.cell(row=r, column=col).font = Font(name="Arial", italic=True, color="808080")
ws2.cell(row=4, column=3, value="(vi du - xoa 2 dong tren, dien that tu day xuong, chi can lam tang nao muon co so do chi tiet)")
ws2.cell(row=4, column=3).font = Font(name="Arial", italic=True, color="808080")

for col, w in zip("ABC", [10, 16, 60]):
    ws2.column_dimensions[col].width = w

# ===== Sheet 3: Danh sach 19 tang co san de doi chieu =====
ws3 = wb.create_sheet("Danh sach tang hien co")
ws3.cell(row=1, column=1, value="Tang").font = Font(name="Arial", bold=True, color="FFFFFF")
ws3.cell(row=1, column=1).fill = PatternFill("solid", fgColor="2E7D32")
ws3.cell(row=1, column=2, value="Ten tang hien tai").font = Font(name="Arial", bold=True, color="FFFFFF")
ws3.cell(row=1, column=2).fill = PatternFill("solid", fgColor="2E7D32")
floor_names = ["Tang tret (G)"] + [f"Tang {i}" for i in range(1, 19)]
for i, name in enumerate(floor_names):
    ws3.cell(row=i+2, column=1, value=i)
    ws3.cell(row=i+2, column=2, value=name)
for col, w in zip("AB", [10, 20]):
    ws3.column_dimensions[col].width = w

wb.save("toa_k_du_lieu.xlsx")
print("saved")
