# Dermat meeting 3 — complete build plan (A to H)

Source: client meeting 3 on 16 Oct 2026 (recording parts P1–P3 in `Downloads/Wantace-projects/third-meeting-changes/`), the client's files from that meeting (Customer Registration form, Index of R&D trial batch, sales order DER/SO/2425/260, filled order form photo), and the owner's answers to the open questions on 18 Oct 2026 (marked **Owner 18 Oct**).

Rule for the build: finish one phase, test it (API + browser as the real department user), commit, then start the next. Nothing from the meeting may be dropped; every line below has an id so the test lists can tick it.

Status words: **Done** (built and tested), **Build** (to build), **Waiting** (needs a client file), **Later** (agreed to do after go-live).

---

## Answers that settle the open questions (Owner 18 Oct)

| # | Question | Answer used in this plan |
|---|---|---|
| 4 | Sample token vs 40% advance | Separate money. Some new orders pay a sample charge first; it is **not** adjusted against the order advance (the client may never come back). Recorded separately, shown separately, and included in the customer's total received. The order advance may be any amount, not always 40%. |
| 6 | R&D number | Dermat's own rule: one R&D number per product request (e.g. RD 200) and a running suffix per sample: RD200-1, RD200-2 … (first sample rejected → second sample is -2). Their trial index and order form use this format (RD0486-01). |
| 7 | Production batch no. | From the recording (P3 26:10): product code + 2-digit batch. Product 570 → 57001, 57002 … Product 890 → 89001 … 89009. No skipped numbers. |
| 8 | Composition sheet | Both: upload the Word file **and** type it in the system. |
| 9 | Artwork approval link | Public link with a signature box, name, date, time and IP. |
| 10 | Test parameters | Keep the current list; QA/QC can add more parameters themselves. |
| 11 | Who raises which PM request | From the recording: labels go on during filling (P1 40:13), boxes are ordered at manufacturing start (P1 40:32). So **QA Filling** raises the primary pack (bottle / jar / tube, cap, pump, dropper, label); **QA Packing** raises the secondary pack (carton, shipper, leaflet, tray). |
| 12 | Shipper label | QR that anyone can scan to see the shipment data. Some products are only a bottle with no box. |
| 13 | No-box products | Packaging code without Carton (already possible). |
| — | Packaging variations | A packaging item (bottle, cap …) gets size variations: pick the item, add a size, the new PM product is created. |
| 15 | Supplier name | Visible by permission. |
| 16 | RM categories | Client's own category list, editable in Masters. |
| 17 | Tally | No integration. Invoices are made here and stay here; the Tally export file stays as it is. |
| 18 | Email | Open the user's own email with a link to a public document page (no attachments, no sending server needed). Also build the list of public customer documents. |
| 19 | WhatsApp | Build WhatsApp notifications. |
| 20 | Google Sheets | Check if the sheet can be connected both ways (they write in the sheet, the ERP updates). |
| 21, 22 | Dry run, go-live, stock | Load their data (products, stock, customers…) when they send it. |

---

## Phase A — Order flow and money

| Id | What | Where | Status |
|---|---|---|---|
| A1 | Artwork & packaging starts right after the advance; it no longer waits for sampling. Sampling stays in the formula arm (Formula & BOM waits for sampling). Manufacturing still waits for both arms. | `dermat_orders/lib/stages.ts` (`artwork.after`), order rail, stage pages | Build |
| A2 | Order type New / Repeat / Revision; "Sampling needed" per line; "Same formula as" another product. Repeat or "same as" → sampling is skipped automatically with a note. | `OrderForm.tsx`, `api/orders/route.ts`, engine skip | Build |
| A3 | Two people on every order: Sales person and Coordinator (POC). | order header field `coordinator`, form, order view, order book column | Build |
| A4 | Initial proforma invoice without an order: customer, optional product / pack size / qty / rate lines (free text allowed), plate charges and other charges, bank details, terms, validity. PDF and public link. Later "Link to order" (or "Make order from this PI"): quantity and rate flow into the order. | `dermat_accounts` proformas (order id becomes optional), Accounts → Proforma invoices page | Build |
| A5 | Payments: kinds **Sample charge**, **Order advance**, **Balance**, **Other**. Sample charges are recorded against the customer (and R&D request if known), shown separately, counted in the customer's total received, never counted towards the order advance. Several advance payments per order. Advance % is free. | `dermat_accounts` payments (order id optional, customer id, rd request id, kind `sample`), statement, order money card | Build |
| A6 | Advance stage: amount required, received date = today automatically (still editable by Accounts), proof optional. Credit customers (payment terms = credit) pass the advance stage automatically. "Advance already received" tick at order entry records it and completes the stage. | `stages.ts` advance fields, `lib/service.ts`, `OrderForm.tsx` | Build |
| A7 | Stage name reads "Advance pending" until done, "Advance received" after. | stage label by status | Build |
| A8 | Billing remarks (plate charges, inventory charges) shown at the top of the Final billing stage and on the invoice draft. | billing stage panel, invoice form | Build |
| A9 | Shortage notice when the order is booked and its products have a BOM. | order create → notification + order "Needs attention" | Build |
| A10 | Order copy with new prices (repeat) — keep `?copyFrom=`; add "Copy" in the order book row menu. | order book | Build |

**Test A**: book a new order with sampling, check artwork opens right after the advance while sampling is still open; book a repeat order and check sampling is skipped; record a sample charge for a customer and check it shows in the customer statement but not in the order's advance; record two advance payments on one order; book an order for a credit customer and check the advance passes; make a PI without an order, then link it to a new order; check billing remarks appear at final billing; check the shortage notice.

---

## Phase B — R&D

| Id | What | Where | Status |
|---|---|---|---|
| B1 | R&D request form: product name, client (existing or new name), brand, pack size, sample quantity, date needed, urgency, ingredients (from RM list), fragrance, texture, colour, claims, client instructions, notes. **No pH target.** Requested by = logged-in user, date automatic. | `dermat_rnd` request form + entity | Build |
| B2 | Numbering: request = `RD{n}` (series, e.g. RD0486); each sample / trial = `RD0486-01`, `-02` … The sample number is what goes on the order ("R&D sample batch no."). | `dermat_rnd/lib/service.ts`, `trials.ts`, number series `RD` | Build |
| B3 | Client feedback raises a new round: "on existing sample" (comments only) or "new sample" (new -NN), option to choose actives. | request page | Build |
| B4 | Order of steps: trial → lab results → sample to client → stability runs alongside → approved. Sample can go to the client before stability ends. | trial flow | Build |
| B5 | "Sample with client" print: request form + lab results, no internal dates. | print | Build |
| B6 | Test parameters: current standard list kept; QA/QC can add parameters in Masters; only filled parameters show on prints; Sales can see sample parameters (read only). | `dermat_lists` list `rnd_test_parameters`, lab results view, permissions | Build |
| B7 | Trial screen covers Dermat's trial index (35 columns): development details, quality & stability (40 °C start/end, description, pH, density, centrifuge, viscosity, stability status, R&D status, photo on approval), microbiology (testing date, TAMC, TYMC, S. aureus, P. aeruginosa, E. coli, Salmonella, released date, status). Excel export with the same columns. | trial entity / views | Build |
| B8 | Copy the approved formula into the product BOM after the approval proof is attached. | existing `make_bom` action + proof check | Build |
| B9 | R&D list counts: open requests, samples with clients, approved; monthly report keeps working. | `RdRequestsPage`, report | Build |

**Test B**: raise a request as Sales, process it as R&D, make sample -01, record lab results, send to client, record "changes needed", raise -02 on a new sample, approve, copy the formula to the BOM; check numbering, prints, Sales read-only view of parameters, Excel export columns.

---

## Phase C — Products, packaging and BOM

| Id | What | Where | Status |
|---|---|---|---|
| C1 | Packaging codes master (code = set of standard parts + items made per product). | `dermat_boms` packaging codes | Done (18 Oct) |
| C2 | Order "Packing code" picked from the master, set shown; spec fields free text. | order form | Done (18 Oct) |
| C3 | Pack BOM "Add packaging set". | BOM editor | Done (18 Oct) |
| C4 | Size variations: on a packaging item (bottle, jar, cap, tube …) "Add size" creates a new PM product with the same fields and the new size; on a packaging code "New size from this code" creates the new code and its sized parts. | PM product page, packaging codes page | Build |
| C5 | Packaging code on the Finished Good: chosen once on the product; creates the product's printed items; new pack BOM starts with the set. | product page (FG), BOM editor | Build |
| C6 | Artwork cannot be finished while the order's packing code is not in the master (warning on the order, block on artwork completion). | engine check | Build |
| C7 | Raw material list compact (Excel-like rows), code in its own column, INCI under the name, brand, stock; RM category list editable in Masters. | products list, `dermat_lists` | Build |
| C8 | Supplier name shown only with permission (`dermat_products.supplier`). | product views, API | Build |
| C9 | PM traceability: for any PM item / lot — vendor, received date, PO, GRN, invoice and photo. | PM product page, reservation rows | Build |
| C10 | Batch number = Finished Good's batch code (3 digits, set on the product) + 2-digit running number per product: 57001, 57002 … No gaps; manual entry still allowed. | `api/orders/route.ts nextBatchNumbers`, FG field | Build |

**Test C**: create a size variation of a bottle; set a packaging code on an FG and start a new pack BOM; block artwork for a missing code; check RM list density; log in without supplier permission; open a PM lot's traceability; book two orders for the same FG and check 57001 → 57002.

---

## Phase D — Stage work, people and access (added 18 Oct, owner's top priority)

Problem seen on the order page: a user without rights still sees every stage, other departments' fields, specs, materials and history; a stage with several sub-steps only has "Mark done" buttons and one form for the whole stage at the end, so the person doing a sub-step cannot record what they know at that moment, and one stage cannot be split between the people who really do it.

- K1 Every sub-step is a card: own owner, own fields, own documents, own Done (person and time stamped). Stage fields are assigned to one card each (`StageField.step`, `StageDocument.step`). Per-stage map in the plan page.
- K2 Several people on one stage: each card has an owner department (work right) and responsible person; a user can finish only their cards; admin can finish on behalf (logged).
- K3 The stage finishes when its last required card is Done, running today's completion checks; the end-of-stage form and "Done — send to …" button go away.
- K4 Who sees what: None / View / Work per stage and card. None shows only name, state, department. Tabs (specs, materials, documents, history, money) and the order list follow the same rights; the APIs enforce them.
- K5 Allowance grid in Masters → Team & access (users × stages / cards / pages, None / View / Work; role defaults; Excel import / export; change log). Replaces G1.
- K6 Default person per card (Masters → Workflow stages), assignment when a card opens, reassign, notification. Replaces G3.
- K7 My tasks: open cards for me / my department; the card opens in place; phone layout.
- K8 Department queues list cards, with a sub-step switch.
- K9 One card component and one save path everywhere; optimistic lock per stage.
- K10 Masters → Workflow stages edits cards: rename, add, hide, reorder, owner, default person, fields, required files, waits-for.
- K11 Existing orders: today's ticks become done cards; filled fields show on their card.

Test: one order finished card by card by each department login; a Filling-only user sees only Filling on the page and in the APIs; My tasks and queues finish the same cards; a card added in Masters appears on the next order.

## Phase E — Composition sheet and artwork

| Id | What | Where | Status |
|---|---|---|---|
| D1 | Composition sheet step at the start of the packaging arm (QA): type the composition in the system and/or upload the Word file. Artwork design can start only after it. | artwork sub-steps + fields | Build |
| D2 | Artwork stage shows the packing code, its set and the responsible designer; Hold with reason (barcode / MRP not sent). | artwork panel | Build |
| D3 | Client approval link: public page with the artwork file, composition, approve / ask changes, name, signature box, date, time, IP. Approval completes "Client approved" automatically. Uploading a signed copy stays possible. | public page + token table | Build |
| D4 | QA artwork checklist from Masters (add, hide). | `dermat_lists` list + artwork panel | Build |
| D5 | Raise the PM purchase order from the artwork stage (several items in one PO). | link to PO form with items prefilled | Build |

**Test D**: fill and upload the composition; send the approval link; open it logged out, sign and approve; check the order updated with name, time, IP and signature; tick the QA checklist; raise a PO from the stage.

---

## Phase F — Production floor (works on the phone)

| Id | What | Where | Status |
|---|---|---|---|
| E1 | No time is ever typed: start / finish / check times are recorded automatically (fields shown read-only). | stage forms | Build |
| E2 | Manufacturing: planned kg, actual kg, yield % worked out, wastage, operator, vessel. | manufacturing fields | Build |
| E3 | PM requests: from Filling — primary pack (bottle / jar / tube, cap, pump, dropper, label) raised by QA Filling; from Packing — secondary pack (carton, shipper, leaflet, tray) raised by QA Packing; box request allowed as soon as manufacturing starts. Store issues; floor marks received with the count. | `dermat_store` request prefill by role, stage buttons | Build |
| E4 | Filling: in-process checks every 15 minutes (fill weight, leak test) as a tick with automatic time; units filled, rejected, approximate count for online tube filling; pieces handed to packing. | filling stage | Build |
| E5 | Packing: shows what to pack (packing BOM); PM taken and rejected; pieces per shipper → shipper labels 1…N (PDF, 100 × 75 mm) with a QR that opens a public page with product, batch, mfg / expiry, pieces, box x of N, order no.; products with no box handled. | packing stage, label PDF, public scan page | Build |
| E6 | Phone: stage pages fit a phone, big buttons; site can be added to the home screen. | layout, web manifest | Build |
| E7 | Forms matched to Dermat's BMR. | stage fields | Waiting (BMR file) |

**Test E**: on a phone-size browser as Production / QA Filling / QA Packing / Store: run one order from manufacturing to packing, raise and receive PM requests, tick in-process checks, print shipper labels and scan the QR.

---

## Phase G — Customers, documents, billing and dispatch

| Id | What | Where | Status |
|---|---|---|---|
| F1 | Customer registration public link: customer name, correspondence address, purchase contact (name, phone, email), partner contact, billing address, PAN / VAT / GST no., bill to, ship to, transporter / delivery type, undertaking / insurance no., two dispatch instructions. Submissions wait for Accounts to approve, then become a customer. | public form + review list | Build |
| F2 | Public documents for customers: registration form, proforma invoice, artwork approval, sample sheet, dispatch details. Each has "Send by email" (opens the user's own email with the link) and "WhatsApp". A list of all links sent, per customer and order. | `dermat_accounts` / shared public token table | Build |
| F3 | Dispatch: upload bilty / LR, docket no., vehicle no.; "Send to client" (email / WhatsApp with the public dispatch page). Dispatch team sees upcoming orders. | dispatch stage, dispatch register | Build |
| F4 | Final invoice made here; order closes on the final invoice; Tally export file unchanged (no live connection). | billing | Build |

**Test F**: open the registration link logged out, submit, approve in Accounts; send a PI by email link and WhatsApp; dispatch with bilty and send to client; check the order closes.

---

## Phase H — Notifications and order book (G1–G3 moved to Phase D)

| Id | What | Where | Status |
|---|---|---|---|
| G1 | Allowance sheet: per user a yes / no grid of pages and stages (view / work), editable in Masters → Team & access, and importable from Dermat's sheet. | `dermat_departments` access page | Build |
| G2 | Field rules: money (exists), supplier (C8), formula download (R&D trial sheet hidden from Sales and QA, store cannot download formulas). | APIs + UI | Build |
| G3 | Order book: compact rows, filters by stage, "packing material complete" (green), similar formulation; all stages incl. future; formatted Excel export (xlsx). | order book | Build |
| G4 | Default person per stage (Masters → Workflow stages). | stage settings | Build |
| G5 | Notifications: in-app + My pending work (exist); WhatsApp message to the next person when work reaches them, through the WhatsApp Business Cloud API when its keys are set (off otherwise). | `dermat_dashboard` notifier | Build |
| G6 | Google Sheets: spike — order book to a Google Sheet; check if edits in the sheet can update the ERP safely. Report to the owner before building two-way. | spike | Build (spike) |

**Test G**: give a user only Filling, check every page and API; send a stage to the next person and check the in-app and WhatsApp (sandbox) messages; filters and Excel export.

---

## Phase I — Data and go-live

| Id | What | Status |
|---|---|---|
| H1 | Load Dermat's raw material sheet (all tabs). | Waiting |
| H2 | Load the ~110 packaging codes and the product → code mapping. | Waiting |
| H3 | Load ~900 products and create their BOMs. | Waiting |
| H4 | Load customers, vendors, opening stock (RM and PM) and last month's orders. | Waiting |
| H5 | Dry run with one real batch, then go-live; remove demo data. | Waiting |

---

## Rules for every phase

- Every screen in a `dermat_*` module; no core screens changed (see `apps/mercato/src/modules/AGENTS.md`).
- Every new table gets a migration + snapshot, applied to `dermat_demo` and recorded, and the seed `db/schema.sql` / `migrations-applied.sql` updated.
- Every write uses `useGuardedMutation` and optimistic locking.
- After each phase: `tsc` clean, production build, browser check as the department users, commit.
