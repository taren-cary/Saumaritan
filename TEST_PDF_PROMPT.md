# Test PDF Generation Prompt

Use this prompt with Claude to generate a test PDF for the Saumaritan upload feature.

---

## PROMPT

Create a single-page PDF document containing exactly 10 financial transactions formatted as a simple table. The transactions should be for a nonprofit organization called "Bright Futures Community Action Agency" and should be a mix of allowable and questionable expenses typical of a Head Start federal grant.

Format the document as plain text with clear columns:

```
BRIGHT FUTURES COMMUNITY ACTION AGENCY
Financial Transaction Report — Q2 2024
Grant: HHS Head Start | #06CH010234

Date        | Description                        | Vendor                      | Amount
------------|------------------------------------|-----------------------------|----------
2024-04-03  | Classroom supplies - crayons/paper  | Staples                     | $234.50
2024-04-08  | Staff training - child development  | National Head Start Assoc.  | $450.00
2024-04-11  | Office supplies                     | Amazon Business             | $87.23
2024-04-15  | Payroll processing fee              | ADP Payroll Services        | $175.00
2024-04-18  | Staff appreciation dinner           | Ruth's Chris Steak House    | $1,240.00
2024-04-22  | Educational toys - toddler room     | Lakeshore Learning          | $389.75
2024-04-25  | Mileage reimbursement - home visits | Staff Expense Report        | $156.40
2024-04-29  | Team building event - bowling       | Bowlero Entertainment       | $680.00
2024-05-02  | Cleaning supplies                   | Grainger Industrial         | $143.88
2024-05-07  | Board meeting dinner                | Nobu Restaurant             | $2,100.00

Total: $5,656.76
```

Save this as a PDF file. The PDF should have readable text (not a scan) so it can be parsed by a text extraction library.

---

## Planted Violations

| Row | Description | Violation | Citation |
|-----|-------------|-----------|----------|
| 5 | Staff appreciation dinner — Ruth's Chris | Entertainment, unallowable | 2 CFR §200.438 |
| 8 | Team building event — bowling | Social activity, unallowable | 2 CFR §200.438 |
| 10 | Board meeting dinner — Nobu Restaurant | Entertainment + no attendee list + excessive amount | 2 CFR §200.438, §200.432 |

---

## How to Create the PDF

**Option A — Google Docs:**
1. Open [docs.google.com](https://docs.google.com)
2. Paste the table above
3. File → Download → PDF Document

**Option B — Microsoft Word:**
1. Paste the table into a Word document
2. File → Save As → PDF

**Option C — Browser:**
1. Paste the text into any webpage or text editor
2. Print → Save as PDF

> **Important:** Must be a text-based PDF (not a photo or screenshot).
> If you upload a scanned PDF the app will return an error and ask you to upload as JPG/PNG instead.
