# Saumaritan Test Data Generation Prompt

Use the following prompt with Claude to generate a realistic federal grant scenario and transaction CSVs for thorough compliance testing.

---

## PROMPT

You are a federal grant compliance expert and data generator. Generate a complete, realistic test scenario for a nonprofit grant compliance auditing application. The output must include: (1) a detailed grant setup, (2) a full list of compliance requirements with regulatory citations, and (3) five separate CSV files of transactions. Everything should reflect how a real auditor would encounter data — messy, mixed, some clearly wrong, some borderline, some fine.

---

### PART 1 — GRANT DETAILS

Generate a realistic federal grant with the following characteristics:

**Grant:** HHS Head Start and Early Head Start Program
- **Organization:** Bright Futures Community Action Agency, Inc.
- **EIN:** 47-2381956
- **Grant Number:** 06CH010234/01
- **Awarding Agency:** U.S. Department of Health and Human Services (HHS)
- **Pass-through Entity:** None (direct federal award)
- **CFDA / ALN Number:** 93.600
- **Funder Name:** Administration for Children and Families (ACF), HHS
- **Grant Type:** Federal
- **Award Amount:** $1,247,500.00
- **Period of Performance:** January 1, 2024 – December 31, 2024
- **Indirect Cost Rate:** 15% (Fixed rate, negotiated NICRA with HHS Division of Cost Allocation)
- **Matching Required:** Yes — 20% non-federal match required
- **Reporting Frequency:** Quarterly (SF-425 Financial Report + programmatic report)
- **Status:** Active

**Approved Budget (enter these into the Budget tab):**
| Object Class | Approved Amount |
|---|---|
| Personnel | $620,000 |
| Fringe Benefits | $186,000 |
| Travel | $18,500 |
| Equipment | $12,000 |
| Supplies | $24,000 |
| Contractual | $145,000 |
| Other Direct Costs | $38,000 |
| Indirect | $204,000 |
| **Total** | **$1,247,500** |

---

### PART 2 — GRANT REQUIREMENTS

Generate 12 detailed compliance requirements for this grant. Each requirement must include:
- A realistic **title**
- The correct **regulatory citation** (specific section, not just "2 CFR 200")
- A thorough **description** (2–4 sentences explaining what is required and what is prohibited)
- The **OMB compliance category** it falls under
- A **max amount** where applicable
- **Documentation required**

Requirements must cover these areas:

1. **Allowable Costs — No Entertainment** (2 CFR §200.438)
   - Entertainment costs including amusements, diversion, social activities, and any associated costs (e.g., tickets, meals at social events, alcohol) are unallowable regardless of whether they have a programmatic purpose. This includes staff appreciation events, holiday parties, and team-building activities classified as social in nature.
   - Documentation Required: All costs must have itemized receipts showing no alcohol or entertainment component.

2. **Allowable Costs — No Alcoholic Beverages** (2 CFR §200.423)
   - Costs of alcoholic beverages are unallowable under any circumstance. This applies even if the event itself is allowable (e.g., a conference where alcohol is served). The alcohol portion must be separated and paid with non-federal funds.
   - Max Amount: $0

3. **Personnel — Time and Effort Documentation** (2 CFR §200.430)
   - All personnel whose salary is charged to this award must maintain semi-annual Personnel Activity Reports (PARs) certified by a supervisor. Employees charging 100% of time to this grant must have a semi-annual certification signed by a supervisor with firsthand knowledge of the work performed. Timesheets must be maintained in real time and reconciled to payroll records quarterly.
   - Documentation Required: Signed semi-annual PARs, timesheets, payroll registers, labor distribution reports.

4. **Personnel — Salary Rate Reasonableness** (2 CFR §200.430(b))
   - Salaries charged to the award must not exceed the employee's actual base compensation rate as established in HR records. Overtime must be consistent with the organization's written overtime policy and pre-approved by the Program Director. No salary may be charged at a rate higher than the HHS Secretary's salary ($236,300/year cap for FY2024 per ACF policy).
   - Max Amount: $236,300 per employee per year

5. **Travel — Federal Per Diem Rates** (2 CFR §200.475)
   - All domestic travel costs charged to the grant must comply with the organization's written travel policy and must not exceed U.S. General Services Administration (GSA) per diem rates for the destination city. Lodging must not exceed the GSA lodging per diem. Meals must use the GSA M&IE rate with the standard 75% rate applied on travel days. First-class or business-class airfare is unallowable; coach airfare is required.
   - Documentation Required: Receipts for all lodging, airfare boarding passes, completed travel expense report with destination city GSA rates attached.

6. **Procurement — Competition and Debarment** (2 CFR §§200.320–200.327)
   - All procurement must follow the organization's written procurement policy. Purchases over $10,000 require at least three written quotes. Contracts over $250,000 require full competitive sealed bidding. Before executing any contract, the organization must verify the contractor is not suspended or debarred using SAM.gov. Sole-source contracts require written justification approved by the Board of Directors.
   - Documentation Required: SAM.gov debarment check printout dated before contract execution, competitive bids or sole-source justification, signed contract.

7. **Equipment — Acquisition and Inventory** (2 CFR §200.313)
   - Equipment is defined as items with a unit cost of $5,000 or more and a useful life of more than one year. Equipment purchases must be pre-approved in the award budget or require prior written approval from ACF. The organization must maintain a property record for each equipment item including description, serial number, acquisition date, cost, and % federal share. A physical inventory must be conducted every two years.
   - Max Amount: $12,000 (per approved budget; additional equipment requires prior approval)
   - Documentation Required: Pre-approval documentation, vendor invoice, property record, inventory log.

8. **Period of Performance** (2 CFR §200.309)
   - All costs charged to this award must be incurred on or after January 1, 2024, and on or before December 31, 2024. Pre-award costs are not authorized for this grant. Obligations (purchase orders, contracts signed) must also fall within the performance period. The 90-day liquidation period allows invoices for goods/services delivered before December 31, 2024 to be paid through March 31, 2025.
   - Max Amount: N/A

9. **Indirect Cost Rate Application** (2 CFR §200.414; NICRA dated 03/15/2023)
   - The organization's negotiated indirect cost rate of 15% (fixed) must be applied only to the Modified Total Direct Cost (MTDC) base. The MTDC base excludes equipment purchases over $5,000, the first $25,000 of each subaward, participant support costs, and tuition remission. The organization may not apply indirect to unallowable costs. Indirect costs must not exceed $204,000 total for this award.
   - Max Amount: $204,000
   - Documentation Required: Current signed NICRA, indirect cost rate computation showing MTDC base.

10. **Allowable Costs — No Fundraising** (2 CFR §200.442)
    - Costs of fundraising activities, including staff time spent soliciting donations, fundraising event costs, and marketing materials for fundraising, are unallowable as direct costs to any federal award. Grant-funded staff may not use any portion of their federally-funded time for fundraising activities. Memberships in organizations whose primary purpose is fundraising advocacy are also unallowable.
    - Max Amount: $0
    - Documentation Required: Staff must certify no grant time was used for fundraising in semi-annual PARs.

11. **Allowable Costs — Conferences and Meetings** (2 CFR §200.432)
    - Costs of conferences and meetings are allowable only if they have a clear programmatic purpose directly related to Head Start program operations. Conference costs must be justified in advance, and registration fees must be reasonable and necessary. Costs must be documented with an agenda, list of attendees, and business purpose. Meal costs at conferences are limited to GSA M&IE per diem rates and must not duplicate per diem claimed separately.
    - Documentation Required: Conference agenda, attendee list, registration invoice, business justification memo.

12. **Lobbying — Prohibition on Federal Funds** (31 USC §1352; 2 CFR §200.450)
    - Federal funds may not be used for lobbying Congress or influencing federal legislation or regulations. This includes direct costs (staff time lobbying, travel to lobby) and indirect costs allocated to lobbying activities. The organization must file a Disclosure of Lobbying Activities (SF-LLL) if non-federal funds are used for lobbying related to this award. Any contractor receiving over $100,000 under this grant must certify they have not and will not use federal funds for lobbying.
    - Max Amount: $0 (federal funds)
    - Documentation Required: Signed lobbying certifications from all contractors over $100,000.

---

### PART 3 — CSV FILES

Generate **five separate CSV files** of transactions for this grant. Each file represents a different upload batch (e.g., different months or departments). Each CSV must have these columns:

```
date, description, vendor, amount, budget_category, category, documentation_type
```

**Rules for generating the transactions:**
- Use realistic nonprofit vendor names (not fake names — use plausible businesses like "Staples", "Delta Airlines", "Marriott", "ADP Payroll Services", "ABC Consulting LLC", etc.)
- Mix of allowable, questionable, and clearly unallowable transactions
- Include at least **3 transactions that are clearly unallowable** per file (entertainment, alcohol, outside period of performance, lobbying, fundraising costs, etc.)
- Include at least **2 borderline transactions** per file (e.g., excessive travel, vague descriptions, large sole-source contractor payments, conference meals that may exceed per diem)
- Include at least **15 normal allowable transactions** per file
- Vary amounts from small ($12.47) to large ($45,000)
- Use realistic dates — mostly within 2024 (within the period of performance), but include **1–2 dates outside the period** (before Jan 1, 2024 or after Dec 31, 2024)
- Leave some `vendor` fields blank or with only partial info (like just "Cash" or "Unknown vendor")
- Leave some `description` fields vague ("Miscellaneous supplies", "Meeting expense", "Staff event")
- The `budget_category` column should sometimes be blank or wrong (e.g., a catering bill listed as "supplies")

**File 1: Q1_payroll_and_operations.csv** (~25 rows)
- Mostly payroll-related transactions (ADP payroll runs, fringe benefit payments, retirement contributions)
- Include 2 payroll entries where the rate seems high (potentially over budget per person)
- Include 1 transaction dated December 28, 2023 (before period of performance)
- Include an "employee appreciation dinner" at a restaurant
- Include an "office holiday party" catering charge in January

**File 2: Q2_travel_and_training.csv** (~20 rows)
- Staff travel to Head Start conferences, training events
- Several hotel stays — some within GSA per diem, some clearly over (e.g., $389/night in a city with $189 GSA rate)
- First-class airfare for the Executive Director
- Per diem reimbursements — some correct, some doubled (claiming both per diem AND restaurant receipts)
- A conference registration that includes a "cocktail reception" add-on
- A training trip to Washington DC that looks like it included a meeting with a congressional office

**File 3: Q3_contractors_and_supplies.csv** (~22 rows)
- Contractor invoices (curriculum developer, mental health consultant, facilities maintenance)
- One large sole-source contract payment ($48,500 to "Johnson Management Consulting") with vague description
- Supplies purchases (classroom materials, office supplies, cleaning supplies)
- One purchase for a coffee machine and coffee supplies listed as "program supplies"
- One equipment purchase ($6,800 computer server) with no prior approval evidence
- A subscription to a fundraising software platform ("DonorPerfect monthly subscription")
- Alcohol from "Total Wine & More" described as "staff meeting refreshments"

**File 4: Q4_programs_and_events.csv** (~20 rows)
- Program-related costs (educational materials, parent event costs, food for children's meals)
- A "community gala" catering invoice — a fundraising event mislabeled as a "parent engagement event"
- Tickets to a sporting event described as "family engagement activity" ($1,200, 12 tickets)
- A political campaign donation described vaguely as "community relations"
- Several legitimate food/nutrition costs for child meals (allowable under Head Start)
- One transaction dated January 8, 2025 (outside period of performance)
- Membership fees for the "National Nonprofit Advocacy Coalition" (lobbying organization)

**File 5: Q4_end_of_year_closeout.csv** (~18 rows)
- Year-end close transactions including final payroll, equipment, and contractor payments
- A $15,000 payment to an audit firm (allowable as indirect cost — but charged as direct here, creating a double-count issue)
- Prepaid expenses for 2025 rent charged in December 2024 (partially outside period of performance)
- A bonus payment to the Executive Director not in the approved budget
- Final quarterly indirect cost allocation entry
- Several legitimate final supplies and program material purchases
- A $2,100 charge to a restaurant described only as "December board meeting" with no attendee list
- One duplicate payment (same vendor, same amount, two days apart)

---

### OUTPUT FORMAT

For each CSV, output the full CSV content with a header row and all data rows. Make the data feel real — use varied amounts with cents, realistic vendor names, plausible descriptions. Do not make the violations cartoonishly obvious — write them the way they would actually appear in a nonprofit's accounting system (the person coding the expense usually thought it was fine, or was trying to hide it slightly).

After the CSVs, provide a **"Answer Key"** listing every intentional violation you embedded, which file it's in, the row description, the regulatory citation violated, and the expected finding type (material noncompliance, significant deficiency, etc.).

This test data will be used to verify that an AI compliance engine correctly identifies violations and generates accurate GAGAS findings.
