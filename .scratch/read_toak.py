import openpyxl
wb = openpyxl.load_workbook(r"C:\xampp\htdocs\CK\Sơ đồ tòa K.xlsx", data_only=True)
for ws in wb.worksheets:
    print("=== SHEET:", ws.title, "dims:", ws.dimensions, "===")
    for row in ws.iter_rows():
        vals = [c.value for c in row]
        if any(v is not None for v in vals):
            print(vals)
