#!/usr/bin/env python3
"""Build docs/grant-deck-2026-09-11.pptx (16:9) with python-pptx.

Every number on a slide is copied from docs/grant-proposal-2026-09-11.md and the v3 evidence; keep them in step.
Run: python3 scripts/build-grant-deck.py
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

OUT = "docs/grant-deck-2026-09-11.pptx"
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
         "High Tech Mortgage, Inc. · MortgageOS™ servicing layer v3.0.0 · XRPL Grants proposal · September 11, 2026 · github.com/vanfwilson/xrpl-mortgage-tokenizing-htm",
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
     ["XRPL Grants proposal · $200,000 over 12 months · September 11, 2026",
      "High Tech Mortgage, Inc. · Sacramento, California · Metro Manila, Philippines · v3.0.0 live on Testnet"], 16, False, GOLD)

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
    "pay county and carrier on statutory dates",
    "analyse escrow once a year, send statements",
    "keep the books and the evidence in agreement",
], 14, GREY, 3)

# 3. What we built -------------------------------------------------------------------------------------------------
s = slide(); header(s, "What we built: MortgageOS™ servicing layer v3.0.0 (open source, MIT)", 3)
cols = [("Record of account", ["one Multi-Purpose Token issuance per loan", "supply = principal in cents, AssetScale 2", "lock, clawback, escrow allowed; transfer never", "XLS-89d metadata: manifest hash + IPFS CID slot"]),
        ("Guarded accounts", ["DepositAuth on the issuer and both custodial accounts", "DepositPreauth for the servicer and the borrower", "the borrower never pays the issuer", "record locked while a period is unsettled"]),
        ("Settlement", ["P&I and impound legs as TokenEscrow of a settlement MPT", "FinishAfter = due date; destination finishes", "split + regulatory markers in the memo", "monthly clawback: on-ledger balance == outstanding"]),
        ("System of record", ["PostgreSQL schema: loans, issuances, every tx with state", "Pending → Confirmed / Failed, full envelope", "audit log of every failed broadcast and timeout", "reconciliation sweep, ledger vs books"])]
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
    "holds one non-transferable record of account per loan; its balance is the outstanding principal, reconciled to the books",
    "settles every P&I and impound leg to the cent under a date lock, with the split in the memo and no personal data",
    "refuses payments from anyone not pre-authorized; freezes the record while a period is unsettled",
    "keeps every transaction, error code and timeout in an audit trail an examiner can open",
], 15)
rect(s, Inches(6.8), Inches(1.4), Inches(6.0), Inches(5.3), LIGHT)
text(s, Inches(7.0), Inches(1.5), Inches(5.6), Inches(0.5), "Does not", 20, True, GOLD)
bullets(s, Inches(7.0), Inches(2.05), Inches(5.6), Inches(4.5), [
    "decide what the borrower owes: the servicer's books in the bank's custodial accounts are authoritative",
    "replace the Note, Deed of Trust, lien, county record or custodial accounts",
    "tokenize the note, sell interests in loans, or raise capital: the record has no CanTransfer flag",
    "prove legal compliance, payee receipt, document validity or custody by itself",
], 15)

# 5. Live proof -----------------------------------------------------------------------------------------------------
s = slide(); header(s, "Live proof on XRPL Testnet: v3 verification run, September 11, 2026", 5)
bullets(s, Inches(0.5), Inches(1.4), Inches(7.6), Inches(5), [
    "Phase 1: DepositAuth and Preauth set and read back; record MPT minted with flags 0x4e (lock, require-auth, escrow, clawback; no transfer); servicer authorized and delivered 45,000,000 units; ledger issuance id equals the database row.",
    "Phase 2: schedule read from PostgreSQL; P&I ($2,844.31) and impound ($655.21) legs escrowed with the split in the memo; record locked; both escrows finished on the due date with tesSUCCESS; $406.81 of principal clawed back; on-ledger balance 44,959,319 == database outstanding.",
    "Phase 3: a forced ledger error (tecPATH_PARTIAL) and a forced network timeout both caught, written to the audit log with the raw code and full envelope, engine exits cleanly.",
    "Independent evaluator re-ran the suite from a clean context: 12 of 12 criteria passed.",
], 14)
table(s, Inches(8.4), Inches(1.4), Inches(4.5), [
    ["Proof", "Result"],
    ["Confirmed transactions per run", "17"],
    ["MPT issuances (record + settlement)", "2"],
    ["Escrow legs finished on date", "2 of 2, tesSUCCESS"],
    ["Clawback = month-1 principal", "40,681 units"],
    ["Lock, unlock", "tesSUCCESS, tesSUCCESS"],
    ["Ledger balance = books", "44,959,319 = 44,959,319"],
    ["Forced errors triaged", "tecPATH_PARTIAL, timeout"],
    ["Pending transactions after run", "0"],
], [2.6, 1.9], 11)
text(s, Inches(8.4), Inches(4.9), Inches(4.5), Inches(1.6), "Only amendments live on Mainnet: MPTokensV1, TokenEscrow, Clawback, DepositAuth, DepositPreauth. Evidence: docs/evidence/v3/.", 12, False, GREY)

# 6. The month, to the cent -------------------------------------------------------------------------------------------
s = slide(); header(s, "One month of servicing, to the cent (fixture: 30-year fixed, $450,000 at 6.5 %)", 6)
table(s, Inches(0.5), Inches(1.4), Inches(6.2), [
    ["Figure", "Value"],
    ["Principal = record supply", "$450,000.00 = 45,000,000 units"],
    ["P&I, fixed for the life of the loan", "$2,844.31"],
    ["Month-1 interest / principal", "$2,437.50 / $406.81"],
    ["Tax impound (1/12 of $6,062.50)", "$505.21 / month"],
    ["Hazard impound (1/12 of $1,800.00)", "$150.00 / month"],
    ["Monthly payment", "$3,499.52"],
    ["Outstanding after month 1", "$449,593.19 = 44,959,319 units"],
], [3.6, 2.6], 12)
bullets(s, Inches(7.0), Inches(1.4), Inches(5.8), Inches(5.2), [
    "RESPA 12 CFR 1024.17: impounds are one-twelfth of the last actual annual bill; a bill above what was collected is advanced by the servicer and recovered at the next analysis.",
    "The borrower escrows both legs; each escrow cannot be finished before its due date on the ledger itself.",
    "After settlement the issuer claws back exactly the principal portion, so the record's balance is the outstanding principal, and the reconciliation sweep proves it against the books.",
    "The offline test checks the payment against the closed-form annuity to the cent and that 360 principal portions sum to the principal exactly.",
], 14)

# 7. Compliance scope ------------------------------------------------------------------------------------------------
s = slide(); header(s, "Regulation as code: what v3 enforces today and what is ported next", 7)
table(s, Inches(0.5), Inches(1.4), Inches(12.3), [
    ["Rule", "v3.0 today", "Ported from v2 during M2–M3"],
    ["RESPA 12 CFR 1024.17", "rolling 1/12 impound collection, servicer advance on shortfall, date-locked disbursement, markers in every memo", "aggregate analysis with one-sixth cushion, surplus / shortage / deficiency options, initial and annual statements"],
    ["1024.33, .35-.41", "record lock and audit trail as the evidence base", "transfer notices and 60-day grace, notice of error, information requests, force-placed insurance, early intervention, loss mitigation"],
    ["Regulation Z 1026.36(c), .41", "receipt-dated settlement events", "periodic statement content, ownership-transfer notice"],
    ["Licensing, GLBA", "no PII on the ledger; no operator keys", "boarding gate on a current servicing authority"],
    ["IRS", "interest per period in the schedule and memo", "Form 1098, 1099-INT"],
], [3.0, 4.6, 4.7], 12)
text(s, Inches(0.5), Inches(5.6), Inches(12.3), Inches(0.9), "The v2 control map (R01–R31, 127 named tests) is archived on main and is the porting roadmap, not a v3 feature. v3 is graded by a live suite that ends in a reconciliation sweep and prints a single pass string only when every phase passed.", 13, False, GREY)

# 8. Settlement safety ----------------------------------------------------------------------------------------------
s = slide(); header(s, "Settlement safety: one submit path, every failure in the audit log", 8)
bullets(s, Inches(0.5), Inches(1.4), Inches(6.2), Inches(5.2), [
    "Every transaction goes through one function: autofill and sign once, record it Pending with its hash and full envelope, submit, record Confirmed or Failed with the ledger result.",
    "tec / tef / tem codes and network timeouts are triaged, never crash the loop, and are written to the audit log with the raw code and the envelope for review.",
    "Postgres is authoritative; the ledger is evidence. A sweep compares outstanding principal to the on-ledger balance; a mismatch is an incident, not a silent state.",
    "The code refuses Mainnet endpoints. All runs are on the public Testnet with a self-issued test USD.",
], 15)
rect(s, Inches(7.0), Inches(1.4), Inches(5.8), Inches(5.2), LIGHT)
text(s, Inches(7.2), Inches(1.5), Inches(5.4), Inches(0.5), "Evidence an examiner can open", 18, True, BLUE)
bullets(s, Inches(7.2), Inches(2.1), Inches(5.4), Inches(4.4), [
    "mortgageos.ledger_transactions: hash, type, account, state, result code, ledger index, parsed memo, envelope, meta",
    "mortgageos.escrow_legs: owner, destination, units, FinishAfter, create and finish hashes, status",
    "mortgageos.audit_log: phase, error code, error text, envelope, timestamp",
    "mortgageos.loans: outstanding principal, the number the ledger is reconciled to",
], 13, NAVY, 4)

# 9. Cost model -----------------------------------------------------------------------------------------------------
s = slide(); header(s, "What a loan-year costs on the ledger", 9)
table(s, Inches(0.5), Inches(1.4), Inches(6.0), [
    ["Production footprint per loan-year (v3)", "Value"],
    ["Transactions (7 per month + boarding)", "about 90"],
    ["Fees burned (10 drops each)", "about 900 drops"],
    ["Owner reserve parked (2 MPToken objects, refundable)", "about 0.4 XRP"],
    ["Escrow reserve", "transient, released on finish"],
    ["All-in per loan-month at $5 / XRP", "under $0.20"],
], [4.2, 1.8], 12)
bullets(s, Inches(0.5), Inches(4.0), Inches(12.3), Inches(2.5), [
    "Fees are negligible at any plausible price; the only material line is the refundable reserve.",
    "Priced as an evidence and settlement add-on at $0.50 to $1.50 per loan per month on top of the servicing fee. Incumbent platforms charge $10 to $30 per loan per month.",
], 14)

# 10. Business ------------------------------------------------------------------------------------------------------
s = slide(); header(s, "Who we are and how we operate", 10)
bullets(s, Inches(0.5), Inches(1.4), Inches(6.2), Inches(5.2), [
    "High Tech Mortgage, Inc.: licensed California mortgage broker (DFPI and DRE), Sacramento, with an operations centre in Manila.",
    "Loans: standard Fannie Mae uniform-instrument, fixed-rate, 30-year residential, funded and owned by banks under contract.",
    "No capital raising, no investors, no interests in loans sold. The record of account cannot be transferred.",
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
    ["M2", "2-4", "Port the v2 aggregate analysis and statements onto the v3 core; live tax-bill source behind an operator verification gate; IPFS pinning with the CID verified in the record", "ported tests, verified-bill trail, CID checks"],
    ["M3", "4-7", "Live custodial statements and three-way reconciliation; 1024.35-.41 case workflows with SLA evidence; dual-control task queue for Manila", "reconciliation reports, fixtures, queue log"],
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
    ["Servicing and data engineering (porting v2 controls, bank receipts, tax-bill source, cases, PDFs, queue)", "$50,000"],
    ["Security and independent technical review", "$25,000"],
    ["Legal and regulatory", "$25,000"],
    ["Document and AI ingestion (scanner port, IPFS manifest pinning)", "$15,000"],
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
    "No production stablecoin can be escrowed today (RLUSD issuers do not allow trust-line locking); the settlement asset is a self-issued test USD MPT and an open decision.",
    "California residential consumer-protection carve-outs and the Idaho servicing posture go to counsel before a live loan.",
    "Tax and hazard bills in the runs are fixture values; production needs a live bill source behind an operator verification gate (M2).",
    "The loan manifest is hashed into the record but not yet pinned to IPFS; the CID slot is an operator step until a pinning service is on file (M2).",
    "v3 does not yet include the v2 statements, aggregate analysis with cushion, case workflows or Form 1098; they are archived on main and ported in M2–M3.",
    "No borrower portal or operator web UI yet: the product surface is the command line and the database.",
], 14)

# 14. Team ------------------------------------------------------------------------------------------------------------
s = slide(); header(s, "Team (as published at hightechmortgage.com/about)", 14)
team = [
    ("assets/brand/team/rich-young-hightechmortgage.jpg", "Rich Young", "Founder, President and Lead Broker",
     ["California DRE Broker's License #01106294", "California Mortgage Broker NMLS #291547", "30+ years Bay Area real estate and mortgage", "Owns origination, servicing and compliance obligations; licensed principal in both operating models"]),
    ("assets/brand/team/van-wilson-hightechmortgage.png", "Dr Van Wilson", "Data Science, AI and Blockchain",
     ["20+ years in data science, mostly in finance; secret clearance while at the U.S. SEC and Fannie Mae", "Fannie Mae: built the ML model forecasting mortgage payments after the COVID payment freeze", "MIT post-graduate degree in data science and AI (2022); CSU Fullerton BS; AWS, Databricks, Blockchain Training Alliance, Microsoft Certified Trainer", "Real-estate investor since 1998, 120+ transactions, $10M+ portfolio; built v2.0 and v3.0 · linkedin.com/in/drvanwilson"]),
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
    "Everything stays open source: the mortgageos schema, the record-of-account MPT pattern, the memo format, the transaction builders, the audit-log contract.",
    "Repository: github.com/vanfwilson/xrpl-mortgage-tokenizing-htm (branch v3)  ·  Evidence: docs/evidence/v3/  ·  Proposal: docs/grant-proposal-2026-09-11.pdf",
], 16)
rect(s, Inches(0.6), Inches(5.6), Inches(12), Inches(1.0), LIGHT)
text(s, Inches(0.8), Inches(5.7), Inches(11.6), Inches(0.8), "High Tech Mortgage, Inc. · 730 I Street, Sacramento, CA 95814 · 19F Marco Polo Ortigas, Pasig City, Metro Manila · info@hightechmortgage.com", 13, False, GREY, anchor=MSO_ANCHOR.MIDDLE)

prs.save(OUT)
print(f"wrote {OUT}: {len(prs.slides)} slides")
