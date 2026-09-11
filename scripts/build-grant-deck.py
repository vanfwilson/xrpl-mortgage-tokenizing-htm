#!/usr/bin/env python3
"""Build docs/grant-deck-2026-09-10.pptx (16:9) with python-pptx.

Every number on a slide is copied from docs/grant-proposal-2026-09-10.md and the v2.0 run record; keep them in step.
Run: python3 scripts/build-grant-deck.py
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

OUT = "docs/grant-deck-2026-09-10.pptx"
NAVY = RGBColor(0x0B, 0x25, 0x45)
BLUE = RGBColor(0x13, 0x5B, 0xA6)
GOLD = RGBColor(0xC9, 0x9A, 0x2E)
GREY = RGBColor(0x55, 0x5F, 0x6B)
LIGHT = RGBColor(0xF3, 0xF5, 0xF8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "Calibri"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
BLANK = prs.slide_layouts[6]
W, H = prs.slide_width, prs.slide_height


def text(slide, x, y, w, h, s, size=18, bold=False, color=NAVY, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    lines = s if isinstance(s, list) else [s]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run()
        r.text = line
        r.font.size, r.font.bold, r.font.name = Pt(size), bold, FONT
        r.font.color.rgb = color
    return tb


def bullets(slide, x, y, w, h, items, size=18, color=NAVY, gap=6):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(gap)
        r = p.add_run()
        r.text = "•  " + it
        r.font.size, r.font.name = Pt(size), FONT
        r.font.color.rgb = color
    return tb


def rect(slide, x, y, w, h, fill, line=None):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
    s.shadow.inherit = False
    return s


def header(slide, title, n):
    rect(slide, 0, 0, W, Inches(1.05), NAVY)
    text(slide, Inches(0.5), Inches(0.18), Inches(11.5), Inches(0.8), title, 28, True, WHITE, anchor=MSO_ANCHOR.MIDDLE)
    text(slide, Inches(12.2), Inches(0.35), Inches(0.9), Inches(0.5), str(n), 12, False, GOLD, PP_ALIGN.RIGHT)
    rect(slide, 0, H - Inches(0.35), W, Inches(0.35), LIGHT)
    text(slide, Inches(0.5), H - Inches(0.34), Inches(12), Inches(0.3),
         "High Tech Mortgage, Inc. · MortgageOS™ servicing layer v2.0.0 · XRPL Grants proposal · September 10, 2026 · github.com/vanfwilson/xrpl-mortgage-tokenizing-htm",
         10, False, GREY)


def table(slide, x, y, w, rows, col_w=None, size=12, header_fill=BLUE):
    nrows, ncols = len(rows), len(rows[0])
    shape = slide.shapes.add_table(nrows, ncols, x, y, w, Inches(0.35) * nrows)
    t = shape.table
    if col_w:
        for i, cw in enumerate(col_w):
            t.columns[i].width = Inches(cw)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = t.cell(r, c)
            cell.text = ""
            p = cell.text_frame.paragraphs[0]
            run = p.add_run()
            run.text = str(val)
            run.font.size, run.font.name = Pt(size), FONT
            run.font.bold = r == 0
            run.font.color.rgb = WHITE if r == 0 else NAVY
            cell.fill.solid()
            cell.fill.fore_color.rgb = header_fill if r == 0 else (LIGHT if r % 2 else WHITE)
            cell.margin_top = cell.margin_bottom = Emu(30000)
    return shape


def slide():
    return prs.slides.add_slide(BLANK)


# 1. Title -----------------------------------------------------------------------------------------------------------
s = slide()
rect(s, 0, 0, W, H, NAVY)
s.shapes.add_picture("assets/brand/htm-logo.png", Inches(0.8), Inches(0.6), width=Inches(6.4))
s.shapes.add_picture("assets/brand/mortgageos-lockup-tight.png", Inches(0.8), Inches(2.75), width=Inches(4.2))
text(s, Inches(0.8), Inches(4.35), Inches(11.5), Inches(1.2), "Service a residential mortgage for thirty years.\nProve every dollar on the XRP Ledger.", 34, True, WHITE)
text(s, Inches(0.8), Inches(5.75), Inches(11.5), Inches(0.9),
     ["XRPL Grants proposal · $200,000 over 12 months · September 10, 2026",
      "High Tech Mortgage, Inc. · Sacramento, California · Metro Manila, Philippines · v2.0.0 live on Testnet"], 16, False, GOLD)

# 2. The problem ---------------------------------------------------------------------------------------------------
s = slide(); header(s, "The problem is the thirty years after closing, not the closing", 2)
bullets(s, Inches(0.6), Inches(1.4), Inches(7.4), Inches(5), [
    "A mortgage is a thirty-year credit asset. The legal note, the servicing books, the cash flows and the evidence trail must stay consistent across tax changes, servicing transfers and audits.",
    "Escrow mistakes, misapplied payments and late tax disbursements are the most common servicing failures and the most expensive to remediate.",
    "Property taxes change every year without warning; the servicer must still pay the bill in full and on time (12 CFR 1024.17(k)) and recover through the annual analysis.",
    "Incumbent servicing systems cost $10 to $30 per loan per month and expose no evidence an examiner can verify independently.",
], 17)
rect(s, Inches(8.4), Inches(1.5), Inches(4.4), Inches(4.6), LIGHT)
text(s, Inches(8.6), Inches(1.65), Inches(4), Inches(0.5), "What a servicer does every month", 16, True, BLUE)
bullets(s, Inches(8.6), Inches(2.2), Inches(4), Inches(3.8), [
    "credit the payment as of the day received",
    "remit P&I to the bank that owns the note",
    "reserve tax and hazard insurance",
    "remit FHA mortgage insurance to HUD",
    "pay county and carrier on statutory dates",
    "analyse escrow once a year, send statements",
    "file Form 1098",
], 14, GREY, 3)

# 3. What we built -------------------------------------------------------------------------------------------------
s = slide(); header(s, "What we built: MortgageOS™ servicing layer v2.0.0 (open source, MIT)", 3)
cols = [("Paper in", ["23-page closing package printed, scanned, OCR'd", "canonical loan record", "every figure tied out to the cent; the run stops on any disagreement"]),
        ("Servicing engine", ["receipt-date application", "12 CFR 1024.17 aggregate analysis with exact (f)(2)-(f)(4) options", "advance-first disbursement", "statements, cases, transfers, Form 1098", "R01-R31 as code, one named test each"]),
        ("XRP Ledger", ["exact-cent issued-USD legs, signed once, journaled, never re-signed", "one NFToken loan-record handle (hash + opaque id)", "TokenEscrow date lock on every verified bill", "2-of-3 signer lists, key drills"]),
        ("Evidence", ["bank receipt-file contract, three-way match", "append-only hash-chained event log", "examiner evidence pack with SHA-256 manifest", "cost model per loan-year"])]
x = Inches(0.5)
for title, items in cols:
    rect(s, x, Inches(1.4), Inches(3.0), Inches(5.3), LIGHT)
    rect(s, x, Inches(1.4), Inches(3.0), Inches(0.55), BLUE)
    text(s, x + Inches(0.1), Inches(1.45), Inches(2.8), Inches(0.5), title, 16, True, WHITE, anchor=MSO_ANCHOR.MIDDLE)
    bullets(s, x + Inches(0.1), Inches(2.05), Inches(2.8), Inches(4.5), items, 13, NAVY, 4)
    x += Inches(3.15)

# 4. Ledger does / does not ---------------------------------------------------------------------------------------
s = slide(); header(s, "What the ledger does, and what it does not do", 4)
rect(s, Inches(0.5), Inches(1.4), Inches(6.0), Inches(5.3), LIGHT)
text(s, Inches(0.7), Inches(1.5), Inches(5.6), Inches(0.5), "Does", 20, True, BLUE)
bullets(s, Inches(0.7), Inches(2.05), Inches(5.6), Inches(4.5), [
    "fingerprints the loan file: NFToken URI = {v, loan, sha256, ptr}, nothing else",
    "records every settlement leg to the cent with a six-key memo and no personal data",
    "locks each verified impound bill until its statutory date; an early release fails on the ledger itself",
    "proves servicing hand-offs and key-management drills",
], 15)
rect(s, Inches(6.8), Inches(1.4), Inches(6.0), Inches(5.3), LIGHT)
text(s, Inches(7.0), Inches(1.5), Inches(5.6), Inches(0.5), "Does not", 20, True, GOLD)
bullets(s, Inches(7.0), Inches(2.05), Inches(5.6), Inches(4.5), [
    "decide what the borrower owes: the servicer's books in the bank's custodial accounts are authoritative",
    "replace the Note, Deed of Trust, lien, county record or custodial accounts",
    "tokenize the note, sell interests in loans, or raise capital",
    "prove legal compliance, payee receipt, document validity or custody by itself",
], 15)

# 5. Live proof -----------------------------------------------------------------------------------------------------
s = slide(); header(s, "Live proof on XRPL Testnet: run-mtvzvtnk, September 10, 2026", 5)
s.shapes.add_picture("assets/deck/demo-live-2026-09-10.png", Inches(0.5), Inches(1.35), width=Inches(7.6))
text(s, Inches(0.5), Inches(6.3), Inches(7.6), Inches(0.4), "vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo (reads Testnet in the browser)", 11, False, GREY)
table(s, Inches(8.4), Inches(1.4), Inches(4.5), [
    ["Proof", "Result"],
    ["Ledger transactions", "108"],
    ["Settlement legs journaled validated", "75 of 75"],
    ["Impound escrows finished on date", "3"],
    ["Early finish attempt", "refused: tecNO_PERMISSION"],
    ["1-of-3 signature on a 2-of-3 list", "refused: tefBAD_QUORUM"],
    ["2-of-3 signatures", "tesSUCCESS"],
    ["Master key after disable", "refused: tefMASTER_DISABLED"],
    ["Bank = subledger = ledger", "75 matched, 0 unmatched"],
    ["Business-event chain", "19 events, verified"],
], [2.6, 1.9], 11)
text(s, Inches(8.4), Inches(5.3), Inches(4.5), Inches(1.2), "Only transaction types live on Mainnet: Payment, NFTokenMint/Offer/Accept, EscrowCreate/Finish/Cancel, AccountSet, TrustSet, SetRegularKey, SignerListSet.", 12, False, GREY)

# 6. Escrow analysis worked example ---------------------------------------------------------------------------------
s = slide(); header(s, "The annual escrow analysis, to the cent (fixture: FHA 30-year, $450,000, Idaho)", 6)
table(s, Inches(0.5), Inches(1.4), Inches(6.2), [
    ["Figure", "Value"],
    ["Note = base + financed UFMIP", "$450,000.00 = $442,260.44 + $7,739.56"],
    ["P&I, fixed for the life of the loan", "$2,770.73"],
    ["Tax impound (Ada County, Dec 20 / Jun 20)", "$285.00 / month"],
    ["Hazard impound (renewal Sep 1)", "$125.00 / month"],
    ["FHA MIP (0.50 % of base, 78.98 % LTV)", "$184.28 / month"],
    ["Monthly payment", "$3,365.01"],
    ["Late charge (4 % of P&I, 24 CFR 203.25)", "$110.83"],
], [3.6, 2.6], 12)
bullets(s, Inches(7.0), Inches(1.4), Inches(5.8), Inches(5.2), [
    "Initial deposit at closing: $1,230.50 (tax $855.35, hazard $375.15). Year-one analysis: shortage $479.50; option elected: do nothing (1024.17(f)(3)).",
    "December tax bill $1,710.00 exceeded the impound: servicer advanced $284.65 so the county was paid on time (1024.17(k)); the escrow released on the ledger only on Dec 20.",
    "Year-two analysis: monthly escrow rises from $410.00 to $449.96; shortage spread over 12 months; annual statement delivered within 30 days with evidence.",
    "A surplus of $50 or more would be refunded within 30 days; under $50 credited. California pays 2 % interest on impounds (Civ. Code 2954.8).",
], 14)

# 7. Compliance control map ------------------------------------------------------------------------------------------
s = slide(); header(s, "Regulation as code: 31 controls, one named test each, 127 offline tests", 7)
table(s, Inches(0.5), Inches(1.4), Inches(12.3), [
    ["Rule", "What the code enforces", "Tests"],
    ["RESPA 12 CFR 1024.17", "aggregate method, one-sixth cushion, surplus / shortage / deficiency options, timely disbursement, initial and annual statements", "R01-R10"],
    ["1024.33, .35-.41", "transfer notices and 60-day grace, notice of error, information requests, force-placed insurance, records, early intervention, loss mitigation", "R11-R15"],
    ["Regulation Z 1026.36(c), .41, .39, .3(a)", "receipt-date credit, periodic statement content, ownership-transfer notice, consumer purpose", "R16-R19"],
    ["FHA 24 CFR 203.25, HUD ML 2023-05, 4000.1", "late charge cap 4 %, UFMIP and MIP on the base loan, custodial accounts", "R20-R22"],
    ["California Civ. Code 2954.8, 2954.85; Idaho 63-903", "2 % impound interest, loss-draft account, tax calendar (Idaho interest rule gated as unverified)", "R23-R25"],
    ["Licensing, vendor oversight, GLBA", "boarding refuses without a current authority; no operator keys; no PII on the ledger", "R26-R28"],
    ["IRS", "Form 1098 boxes from receipt-dated interest, 1099-INT threshold, 1099-A/C hand-offs", "R29-R31"],
], [3.3, 7.6, 1.4], 12)
text(s, Inches(0.5), Inches(6.3), Inches(12.3), Inches(0.5), "Every control appears in the examiner evidence pack's control map with the test names that carry it. npm test runs them all offline in seconds.", 13, False, GREY)

# 8. Settlement safety ----------------------------------------------------------------------------------------------
s = slide(); header(s, "Settlement safety: sign once, journal first, never re-sign", 8)
bullets(s, Inches(0.5), Inches(1.4), Inches(6.2), Inches(5.2), [
    "Each leg is autofilled and signed once; the signed blob, its hash and a fingerprint are persisted under (company, loan, run, leg) before submission.",
    "On a timeout the transport looks the hash up on the ledger and submits the identical blob only if unknown. A restart returns the validated job without signing or submitting (proven on Testnet after a database reopen).",
    "Reusing a key for a different transaction is refused. A failed engine result is journaled and blocks silent replay.",
    "Degraded mode is a written contract: servicing never blocks on the ledger; the bank's books stay authoritative; legs stay 'prepared' and resume safely.",
], 15)
rect(s, Inches(7.0), Inches(1.4), Inches(5.8), Inches(5.2), LIGHT)
text(s, Inches(7.2), Inches(1.5), Inches(5.4), Inches(0.5), "Evidence an examiner can open", 18, True, BLUE)
bullets(s, Inches(7.2), Inches(2.1), Inches(5.4), Inches(4.4), [
    "bank receipt-file contract: bank_ref, posted_on, loan_ref, direction, amount; strict parse, one dollars-to-cents path",
    "three-way match bank = subledger = ledger by reference; one cent off is a break, never absorbed",
    "append-only, hash-chained business-event log (UPDATE and DELETE rejected by trigger)",
    "npm run evidence: control map, every leg with explorer link, statements, tax forms, reconciliation, chain head, SHA-256 manifest",
], 13, NAVY, 4)

# 9. Cost model -----------------------------------------------------------------------------------------------------
s = slide(); header(s, "What a loan-year costs on the ledger", 9)
table(s, Inches(0.5), Inches(1.4), Inches(6.0), [
    ["Production footprint per loan-year", "Value"],
    ["Transactions (6 legs x 12 months + boarding + escrows)", "81"],
    ["Fees burned (10 drops each)", "810 drops"],
    ["Owner reserve parked (refundable)", "0.8 XRP"],
    ["All-in per loan-month at $2 / XRP", "$0.13"],
    ["All-in per loan-month at $5 / XRP", "$0.33"],
], [4.2, 1.8], 12)
table(s, Inches(6.9), Inches(1.4), Inches(5.9), [
    ["Loans", "Tx / month", "Hours (batched)", "Reserve XRP"],
    ["1,000", "6,333", "0.14", "800"],
    ["10,000", "63,333", "1.4", "8,000"],
    ["100,000", "633,333", "14.1", "80,000"],
], [1.3, 1.5, 1.6, 1.5], 12)
bullets(s, Inches(0.5), Inches(4.6), Inches(12.3), Inches(2), [
    "Fees are negligible at any plausible price; the only material line is the refundable reserve, and it stays under the $0.50 floor of the price band even at $5 per XRP.",
    "Priced as an evidence and settlement add-on at $0.50 to $1.50 per loan per month on top of the servicing fee. Incumbent platforms charge $10 to $30 per loan per month.",
], 14)

# 10. Business ------------------------------------------------------------------------------------------------------
s = slide(); header(s, "Who we are and how we operate", 10)
bullets(s, Inches(0.5), Inches(1.4), Inches(6.2), Inches(5.2), [
    "High Tech Mortgage, Inc.: licensed California mortgage broker (DFPI and DRE), Sacramento, with an operations centre in Manila.",
    "Loans: standard Fannie Mae uniform-instrument, fixed-rate, 30-year residential, funded and owned by banks under contract.",
    "No capital raising, no investors, no interests in loans sold. The note is not tokenized.",
    "The Manila team executes servicing tasks under dual control and never holds signing keys.",
], 15)
rect(s, Inches(7.0), Inches(1.4), Inches(5.8), Inches(2.4), LIGHT)
text(s, Inches(7.2), Inches(1.5), Inches(5.4), Inches(0.5), "Model A: servicer of record", 16, True, BLUE)
text(s, Inches(7.2), Inches(2.0), Inches(5.4), Inches(1.7), "HTM services its own clients' loans under its California licences through a servicing entity kept separate from the brokerage.", 14, False, NAVY)
rect(s, Inches(7.0), Inches(4.1), Inches(5.8), Inches(2.5), LIGHT)
text(s, Inches(7.2), Inches(4.2), Inches(5.4), Inches(0.5), "Model B: bank's servicing contractor", 16, True, BLUE)
text(s, Inches(7.2), Inches(4.7), Inches(5.4), Inches(1.8), "A lending bank is the official servicer and keeps banking compliance and liability; HTM runs servicing operations and the technology. Several banks have asked for exactly this.", 14, False, NAVY)

# 11. Milestones ----------------------------------------------------------------------------------------------------
s = slide(); header(s, "Twelve-month milestones", 11)
table(s, Inches(0.5), Inches(1.4), Inches(12.3), [
    ["ID", "Months", "Milestone", "Evidence"],
    ["M1", "1-2", "Counsel memos (CA residential carve-outs, Idaho, custodial asset); first bank servicing contract or LOI; key-management runbook", "memos, LOI, runbook"],
    ["M2", "2-4", "Live custodial statements via the receipt-file contract; daily three-way reconciliation; live tax-bill source behind an operator verification gate", "reconciliation reports, verified-bill trail"],
    ["M3", "4-7", "Full 1024.35-.41 case workflows with SLA evidence; statement PDFs with delivery evidence; dual-control task queue for Manila", "fixtures, golden PDFs, queue log"],
    ["M4", "6-9", "Production key management (HSM, 2-of-3, rotation drills); settlement-asset decision with RLUSD / institutional teams; Mainnet dry-run criteria", "drill logs, decision record"],
    ["M5", "8-10", "Controlled pilot on real, redacted loan files with the contracting bank; Form 1098 season dry run; evidence packs to the bank's examiner", "pilot report, examiner feedback"],
    ["M6", "9-11", "Second-jurisdiction abstraction: legal layer separated from the engine, mapped for the Manila operation", "jurisdiction matrix"],
    ["M7", "11-12", "Independent security review; public technical paper; refreshed demo; Mainnet go/no-go", "review notes, paper, video"],
], [0.6, 0.9, 7.6, 3.2], 11)

# 12. Budget and targets --------------------------------------------------------------------------------------------
s = slide(); header(s, "Budget $200,000 and grant-period targets", 12)
table(s, Inches(0.5), Inches(1.4), Inches(6.6), [
    ["Workstream", "Amount"],
    ["XRPL settlement and evidence engineering", "$60,000"],
    ["Servicing and data engineering (bank receipts, tax-bill source, cases, PDFs, queue)", "$50,000"],
    ["Security and independent technical review", "$25,000"],
    ["Legal and regulatory", "$25,000"],
    ["Document and AI ingestion", "$15,000"],
    ["Pilot infrastructure and testing", "$15,000"],
    ["Developer docs and open-source components", "$7,000"],
    ["Contingency", "$3,000"],
], [5.2, 1.4], 11)
table(s, Inches(7.4), Inches(1.4), Inches(5.4), [
    ["By month 12", "Target"],
    ["Boarded loan records (test and pilot)", "50"],
    ["Ledger transactions", "5,000"],
    ["Servicing events", "1,200"],
    ["Counterparties engaged", "4"],
    ["Reconciliation accuracy vs benchmark", "99 %+"],
], [3.8, 1.6], 11)
text(s, Inches(7.4), Inches(4.0), Inches(5.4), Inches(1.5), "Funding gates: build and integration (M1-M3) 30 %, $60,000; usage and pilot (M4-M7) 70 %, $140,000. Checkpoints at months 4, 7, 10 and 12.", 13, False, GREY)

# 13. Open items ----------------------------------------------------------------------------------------------------
s = slide(); header(s, "What is not yet true, stated plainly", 13)
bullets(s, Inches(0.5), Inches(1.4), Inches(12.3), Inches(5.2), [
    "No bank has signed a servicing contract yet; the operating assumptions are ours.",
    "No production stablecoin can be escrowed today (RLUSD issuers do not allow trust-line locking); the settlement asset is an open decision. The code refuses to build an escrow when the issuer flag is off.",
    "California residential consumer-protection carve-outs and the Idaho servicing posture go to counsel before a live loan; the Idaho escrow-interest rule is gated as unverified in the engine.",
    "Tax and hazard bills in the published runs come from a fixture; production needs a live bill source behind an operator verification gate (M2).",
    "Documents are synthetic; production ingest hashes the custodian-held eNote, not a scan.",
    "No borrower portal or operator web UI yet: the product surface is the command line and the evidence pack.",
], 15)

# 14. Team ------------------------------------------------------------------------------------------------------------
s = slide(); header(s, "Team (as published at hightechmortgage.com/about)", 14)
team = [
    ("assets/brand/team/rich-young-hightechmortgage.jpg", "Rich Young", "Founder, President and Lead Broker",
     ["California DRE Broker's License #01106294", "California Mortgage Broker NMLS #291547", "30+ years Bay Area real estate and mortgage", "Owns origination, servicing and compliance obligations; licensed principal in both operating models"]),
    ("assets/brand/team/van-wilson-hightechmortgage.png", "Dr Van Wilson", "Data Science, AI and Blockchain",
     ["20+ years in data science, mostly in finance; secret clearance while at the U.S. SEC and Fannie Mae", "Fannie Mae: built the ML model forecasting mortgage payments after the COVID payment freeze", "MIT post-graduate program, AI and data science; CSU Fullerton BS; AWS, Databricks, Blockchain Training Alliance, Microsoft Certified Trainer", "Real-estate investor since 1998, 120+ transactions, $10M+ portfolio; built v2.0 · linkedin.com/in/drvanwilson"]),
    ("assets/brand/team/trish-wilson-hightechmortgage.jpeg", "Trish Wilson", "Real Estate, Finance and PH Operations",
     ["Active licensed US Realtor", "Philippine Real Estate Broker PRC 0024025", "CPA (St. Paul University, BA Accounting); Int'l Certified Financial Consultant; ex-internal auditor, Philippine Airlines", "Leads Manila servicing operations under dual control; accounting review"]),
    ("assets/brand/team/bill-thompson-hightechmortgage.jpg", "Bill Thompson", "Operations, IT and Business Management",
     ["ITIL v4; Six Sigma Quality; CompTIA A+; TOPCIT", "Practical Project Mgmt; URAC; FranklinCovey Mgmt", "Ateneo Graduate School of Business; CSU Dominguez Hills", "Operations, infrastructure and process discipline; dual-control task queue"]),
]
x = Inches(0.4)
for img, name, role, creds in team:
    rect(s, x, Inches(1.3), Inches(3.05), Inches(5.7), LIGHT)
    if os.path.exists(img):
        s.shapes.add_picture(img, x + Inches(0.15), Inches(1.45), height=Inches(1.6))
    text(s, x + Inches(0.15), Inches(3.1), Inches(2.8), Inches(0.35), name, 15, True, NAVY)
    text(s, x + Inches(0.15), Inches(3.42), Inches(2.8), Inches(0.5), role, 11, True, BLUE)
    bullets(s, x + Inches(0.15), Inches(3.95), Inches(2.8), Inches(3.0), creds, 10, GREY, 3)
    x += Inches(3.15)

# 15. The ask ---------------------------------------------------------------------------------------------------------
s = slide(); header(s, "The ask", 15)
text(s, Inches(0.6), Inches(1.6), Inches(12), Inches(1.4),
     "$200,000 of milestone-gated funding over 12 months for the plan on slides 11 and 12.", 26, True, NAVY)
bullets(s, Inches(0.6), Inches(3.1), Inches(12), Inches(2.6), [
    "Introductions to banks that outsource servicing operations, and to the RLUSD / institutional team on the custodial-asset question.",
    "Everything stays open source: the canonical loan schema, the regulatory control map and its tests, the memo and receipt-file contracts, the evidence-pack format, the cost model.",
    "Repository: github.com/vanfwilson/xrpl-mortgage-tokenizing-htm  ·  Live demo: vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo  ·  Proposal: docs/grant-proposal-2026-09-10.pdf",
], 16)
rect(s, Inches(0.6), Inches(5.6), Inches(12), Inches(1.0), LIGHT)
text(s, Inches(0.8), Inches(5.7), Inches(11.6), Inches(0.8), "High Tech Mortgage, Inc. · 730 I Street, Sacramento, CA 95814 · 19F Marco Polo Ortigas, Pasig City, Metro Manila · info@hightechmortgage.com", 13, False, GREY, anchor=MSO_ANCHOR.MIDDLE)

prs.save(OUT)
print(f"wrote {OUT}: {len(prs.slides)} slides")
