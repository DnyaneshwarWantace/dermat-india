/**
 * seed-dermat-fake.js
 *
 * Injects 12 fake Dermat orders — one active in each pipeline stage —
 * with FULL stage.data so every stage card renders correctly in the UI.
 *
 * Stages & their data keys (from stages.ts STAGES array):
 *
 *   order        → remarks
 *   advance      → pi_number, advance_percent, advance_amount, received_on,
 *                  payment_ref  + __steps{ pi_sent, advance_received }
 *   sampling     → rd_number, sample_name, sample_sent_on, client_feedback,
 *                  remarks      + __steps{ request, sample_made, sample_sent, client_ok }
 *   artwork      → composition_text, designer_status, status_note,
 *                  artwork_approved_on, remarks
 *                  + __steps{ composition, design, client_approved, qa_final,
 *                             pm_ordered, pm_ok }
 *   formulation  → remarks + __steps{ bom_made, bom_approved }
 *   planning     → material_status, planned_for, planned_vessel, remarks
 *                  + __steps{ checked, reserved, purchase*, received* }
 *   manufacturing→ bulk_source, batch_no, planned_kg, batch_size, mfg_date,
 *                  shift, machine, operator, wastage_kg, remarks
 *                  + __steps{ started, manufactured }
 *   filling      → filled_units, rejected_units, count_type, handed_to_packing,
 *                  filling_date, shift, machine, operator, chemist,
 *                  area_temp, area_rh, empty_weight, filled_weight,
 *                  weight_limit_percent, remarks
 *                  + __steps{ pm_asked, started, filled }
 *   packing      → packed_qty, rejected_pcs, packed_on, pcs_per_shipper,
 *                  shippers, location, label_coded_by, cartons_coded_by, remarks
 *                  + __steps{ pm_asked*, sample, packed }
 *   qc_qa        → qc_result, released_on, coa_no, release_order_no,
 *                  qty_released, retention_qty, retention_location, remarks
 *                  + __steps{ line_clearance, documents, materials,
 *                             qc_review, retention, released }
 *   billing      → invoice_number, invoice_date, balance_status, remarks
 *                  + __steps{ invoice, balance }
 *   dispatch     → dispatch_date, transporter, lr_number, vehicle_no,
 *                  eway_bill_no, eway_bill_date, packages, delivered_on,
 *                  remarks    + __steps{ dispatched, delivered }
 *
 * Usage:
 *   node scripts/seed-dermat-fake.js
 *   node scripts/seed-dermat-fake.js --tenant <id> --org <id>
 *
 * 100% idempotent — ON CONFLICT DO NOTHING on all inserts.
 */

'use strict';

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/mercato/.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/* ── helpers ─────────────────────────────────────────────────────────────── */

function parseArgs() {
  const args = process.argv.slice(2);
  let tenantId = null, organizationId = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--tenant' || args[i] === '--tenantId') && args[i + 1]) tenantId = args[i + 1];
    if ((args[i] === '--org' || args[i] === '--organizationId') && args[i + 1]) organizationId = args[i + 1];
  }
  return { tenantId, organizationId };
}

function iso(d) { return d instanceof Date ? d.toISOString() : d; }

function dAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function dFwd(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }

function dateFmt(d) { return iso(d).slice(0, 10); }

function stableId(base, suffix) {
  // produce a valid v4-ish UUID from a deterministic base
  const s = `${base}${String(suffix).padStart(4, '0')}`;
  return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-a${s.slice(17,20)}-${s.slice(20,32)}`.slice(0, 36).padEnd(36, '0');
}

/* ── stable UUIDs ────────────────────────────────────────────────────────── */
// Using real v4-shaped static UUIDs so ON CONFLICT DO NOTHING works cleanly.

const U = {
  companyProfile: 'fa000001-0000-4000-a000-000000000001',

  cust1: 'fa000002-0000-4000-a000-000000000001',
  cust2: 'fa000002-0000-4000-a000-000000000002',
  cust3: 'fa000002-0000-4000-a000-000000000003',
  cust4: 'fa000002-0000-4000-a000-000000000004',

  prod1: 'fa000003-0000-4000-a000-000000000001',
  prod2: 'fa000003-0000-4000-a000-000000000002',
  prod3: 'fa000003-0000-4000-a000-000000000003',

  o01:  'fa000010-0000-4000-a000-000000000001', // active: order
  o02:  'fa000010-0000-4000-a000-000000000002', // active: advance
  o03:  'fa000010-0000-4000-a000-000000000003', // active: sampling
  o04:  'fa000010-0000-4000-a000-000000000004', // active: artwork
  o05:  'fa000010-0000-4000-a000-000000000005', // active: formulation
  o06:  'fa000010-0000-4000-a000-000000000006', // active: planning
  o07:  'fa000010-0000-4000-a000-000000000007', // active: manufacturing
  o08:  'fa000010-0000-4000-a000-000000000008', // active: filling
  o09:  'fa000010-0000-4000-a000-000000000009', // active: packing
  o10:  'fa000010-0000-4000-b000-000000000010', // active: qc_qa
  o11:  'fa000010-0000-4000-b000-000000000011', // active: billing
  o12:  'fa000010-0000-4000-b000-000000000012', // active: dispatch

  reg1: 'fa000020-0000-4000-a000-000000000001',
  reg2: 'fa000020-0000-4000-a000-000000000002',
};

/* ── pipeline stage list ─────────────────────────────────────────────────── */

const ALL_STAGES = [
  'order', 'advance', 'sampling', 'artwork', 'formulation',
  'planning', 'manufacturing', 'filling', 'packing', 'qc_qa', 'billing', 'dispatch',
];

function idx(key) { return ALL_STAGES.indexOf(key); }

/* ── full stage.data for DONE stages ────────────────────────────────────── */

function doneData(stageKey, daysBack) {
  const at = (n) => iso(dAgo(daysBack + n));
  const date = (n) => dateFmt(dAgo(daysBack + n));

  switch (stageKey) {
    case 'order':
      return {
        remarks: 'Order confirmed after client call. Samples approved.',
      };
    case 'advance':
      return {
        pi_number: `PI/FK/${daysBack}`,
        advance_percent: 40,
        advance_amount: 25000,
        received_on: date(2),
        payment_ref: `UTR${daysBack}FAKE`,
        __steps: {
          pi_sent:          { done: true, at: at(4), by: 'Accounts Team' },
          advance_received: { done: true, at: at(2), by: 'Accounts Team' },
        },
      };
    case 'sampling':
      return {
        rd_number: `RD/FK/${daysBack}`,
        sample_name: 'Moisturising Lotion SPF30',
        sample_sent_on: date(3),
        client_feedback: 'Approved',
        remarks: 'Client approved on first attempt.',
        __steps: {
          request:     { done: true, at: at(8), by: 'R&D Team' },
          sample_made: { done: true, at: at(5), by: 'R&D Team' },
          sample_sent: { done: true, at: at(3), by: 'R&D Team' },
          client_ok:   { done: true, at: at(1), by: 'Client via email' },
        },
      };
    case 'artwork':
      return {
        composition_text: 'Aqua, Glycerin, Niacinamide 5%, Hyaluronic Acid, Allantoin, Carbomer, Triethanolamine, EDTA, Fragrance, Phenoxyethanol.',
        designer_status: 'PM OK',
        status_note: 'Artwork finalised and packing material received.',
        artwork_approved_on: date(3),
        remarks: 'All six steps completed without rework.',
        __steps: {
          composition:    { done: true, at: at(10), by: 'R&D Team' },
          design:         { done: true, at: at(7),  by: 'Designer – Ravi' },
          client_approved:{ done: true, at: at(5),  by: 'Client' },
          qa_final:       { done: true, at: at(4),  by: 'QA Team' },
          pm_ordered:     { done: true, at: at(4),  by: 'Purchase Team' },
          pm_ok:          { done: true, at: at(2),  by: 'Store – PM' },
          pm_asked:       { done: true, at: at(5),  by: 'Planning' },
        },
      };
    case 'formulation':
      return {
        remarks: 'BOM created for all line items.',
        __steps: {
          bom_made:    { done: true, at: at(4), by: 'R&D Head' },
          bom_approved:{ done: true, at: at(2), by: 'QA Head' },
        },
      };
    case 'planning':
      return {
        material_status: 'All available',
        planned_for: date(1),
        planned_vessel: 'Vessel V-3 (500 L)',
        remarks: 'All RM and PM available in stock.',
        __steps: {
          checked:  { done: true, at: at(4), by: 'Planning' },
          reserved: { done: true, at: at(3), by: 'Planning' },
        },
      };
    case 'manufacturing':
      return {
        bulk_source: 'Make a new batch',
        batch_no: `BT/FK/${daysBack}`,
        planned_kg: 120,
        batch_size: 118.5,
        mfg_date: date(2),
        shift: 'A',
        machine: 'Vessel V-3 (500 L)',
        operator: 'Ganesh Pawar',
        wastage_kg: 1.5,
        remarks: 'Batch completed on schedule.',
        __steps: {
          started:      { done: true, at: at(3), by: 'Production' },
          manufactured: { done: true, at: at(1), by: 'Production' },
        },
      };
    case 'filling':
      return {
        filled_units: 2980,
        rejected_units: 20,
        count_type: 'Counted',
        handed_to_packing: 2980,
        filling_date: date(2),
        shift: 'A',
        machine: 'Filling Line 1',
        operator: 'Suresh Kamble',
        chemist: 'Dr. Meera Joshi',
        area_temp: 23,
        area_rh: 50,
        empty_weight: 28.5,
        filled_weight: 128.5,
        weight_limit_percent: 2,
        remarks: 'Filling completed. 20 units rejected due to weight variance.',
        __steps: {
          pm_asked: { done: true, at: at(4), by: 'Planning' },
          started:  { done: true, at: at(3), by: 'Production' },
          filled:   { done: true, at: at(1), by: 'Production' },
        },
      };
    case 'packing':
      return {
        packed_qty: 2980,
        rejected_pcs: 5,
        packed_on: date(1),
        pcs_per_shipper: 24,
        shippers: 124,
        location: 'FG Store – Bay 3',
        label_coded_by: 'Vijay Shinde',
        cartons_coded_by: 'Vijay Shinde',
        remarks: 'Packed and moved to FG store.',
        __steps: {
          pm_asked: { done: true, at: at(3), by: 'Planning' },
          sample:   { done: true, at: at(2), by: 'QA' },
          packed:   { done: true, at: at(1), by: 'Production' },
        },
      };
    case 'qc_qa':
      return {
        qc_result: 'Released',
        released_on: date(1),
        coa_no: `COA/FK/${daysBack}`,
        release_order_no: `RO/FK/${daysBack}`,
        qty_released: 2975,
        retention_qty: 5,
        retention_location: 'QA Retention Cabinet R2',
        remarks: 'All QC parameters within spec. Batch released.',
        __steps: {
          line_clearance: { done: true, at: at(6), by: 'QA Team' },
          documents:      { done: true, at: at(5), by: 'QA Team' },
          materials:      { done: true, at: at(4), by: 'QA Team' },
          qc_review:      { done: true, at: at(3), by: 'QA Head' },
          retention:      { done: true, at: at(2), by: 'QA Team' },
          released:       { done: true, at: at(1), by: 'QA Head' },
        },
      };
    case 'billing':
      return {
        invoice_number: `INV/FK/${daysBack}`,
        invoice_date: date(2),
        balance_status: 'Received',
        remarks: 'Invoice raised and balance payment received via NEFT.',
        __steps: {
          invoice: { done: true, at: at(3), by: 'Accounts Team' },
          balance: { done: true, at: at(1), by: 'Accounts Team' },
        },
      };
    case 'dispatch':
      return {
        dispatch_date: date(2),
        transporter: 'Shree Maruti Courier',
        lr_number: `LR/FK/${daysBack}`,
        vehicle_no: 'MH 04 FK 4200',
        eway_bill_no: `EWB${daysBack}`,
        eway_bill_date: date(2),
        packages: 124,
        delivered_on: date(0),
        remarks: 'Delivered on time. Client acknowledged receipt.',
        __steps: {
          dispatched: { done: true, at: at(2), by: 'Dispatch Team' },
          delivered:  { done: true, at: at(0), by: 'Dispatch Team' },
        },
      };
    default:
      return {};
  }
}

/* ── partial / in-progress data for the OPEN (active) stage ─────────────── */

function openData(stageKey) {
  switch (stageKey) {
    case 'order':
      return { remarks: 'Order booked — awaiting next steps.' };
    case 'advance':
      return {
        pi_number: 'PI/FK/ADV',
        advance_percent: 40,
        __steps: {
          pi_sent: { done: true, at: iso(dAgo(2)), by: 'Accounts Team' },
          // advance_received: not yet done
        },
      };
    case 'sampling':
      return {
        rd_number: 'RD/FK/SMP',
        __steps: {
          request:     { done: true, at: iso(dAgo(5)), by: 'R&D Team' },
          sample_made: { done: true, at: iso(dAgo(3)), by: 'R&D Team' },
          // sample_sent, client_ok: pending
        },
      };
    case 'artwork':
      return {
        composition_text: 'Aqua, Glycerin, Niacinamide 5%, Hyaluronic Acid, Phenoxyethanol.',
        designer_status: 'Artwork',
        status_note: 'Artwork in progress with designer.',
        __steps: {
          composition: { done: true, at: iso(dAgo(6)), by: 'R&D Team' },
          design:      { done: true, at: iso(dAgo(3)), by: 'Designer – Ravi' },
          // client_approved, qa_final, pm_ordered, pm_ok: pending
        },
      };
    case 'formulation':
      return {
        __steps: {
          bom_made: { done: true, at: iso(dAgo(2)), by: 'R&D Head' },
          // bom_approved: pending
        },
      };
    case 'planning':
      return {
        material_status: 'Purchase raised',
        planned_for: dateFmt(dFwd(5)),
        planned_vessel: 'Vessel V-2 (300 L)',
        __steps: {
          checked: { done: true, at: iso(dAgo(2)), by: 'Planning' },
          // reserved, purchase, received: pending
        },
      };
    case 'manufacturing':
      return {
        bulk_source: 'Make a new batch',
        batch_no: 'BT/FK/MFG',
        planned_kg: 100,
        batch_size: 99.5,
        mfg_date: dateFmt(dAgo(1)),
        shift: 'A',
        machine: 'Vessel V-2 (300 L)',
        operator: 'Ganesh Pawar',
        __started: true,
        __steps: {
          started: { done: true, at: iso(dAgo(1)), by: 'Production' },
          // manufactured: pending
        },
      };
    case 'filling':
      return {
        filled_units: 1500,
        filling_date: dateFmt(dAgo(1)),
        shift: 'A',
        machine: 'Filling Line 1',
        operator: 'Suresh Kamble',
        area_temp: 23,
        area_rh: 50,
        __started: true,
        __steps: {
          pm_asked: { done: true, at: iso(dAgo(3)), by: 'Planning' },
          started:  { done: true, at: iso(dAgo(1)), by: 'Production' },
          // filled: pending
        },
      };
    case 'packing':
      return {
        packed_qty: 2500,
        pcs_per_shipper: 24,
        __started: true,
        __steps: {
          pm_asked: { done: true, at: iso(dAgo(3)), by: 'Planning' },
          sample:   { done: true, at: iso(dAgo(2)), by: 'QA' },
          // packed: pending
        },
      };
    case 'qc_qa':
      return {
        __steps: {
          line_clearance: { done: true, at: iso(dAgo(4)), by: 'QA Team' },
          documents:      { done: true, at: iso(dAgo(3)), by: 'QA Team' },
          materials:      { done: true, at: iso(dAgo(2)), by: 'QA Team' },
          // qc_review, retention, released: pending
        },
      };
    case 'billing':
      return {
        invoice_number: 'INV/FK/BIL',
        invoice_date: dateFmt(dAgo(2)),
        balance_status: 'Pending',
        __steps: {
          invoice: { done: true, at: iso(dAgo(2)), by: 'Accounts Team' },
          // balance: pending
        },
      };
    case 'dispatch':
      return {
        dispatch_date: dateFmt(dAgo(1)),
        transporter: 'Shree Maruti Courier',
        lr_number: 'LR/FK/DIS',
        vehicle_no: 'MH 04 FK 9900',
        packages: 104,
        __started: true,
        __steps: {
          dispatched: { done: true, at: iso(dAgo(1)), by: 'Dispatch Team' },
          // delivered: pending
        },
      };
    default:
      return {};
  }
}

/* ── build all stage rows for one order ─────────────────────────────────── */

function makeStageRows(orderId, activeStage, org, tenant) {
  const activeIdx = idx(activeStage);

  return ALL_STAGES.map((key, i) => {
    let status, data;

    if (i < activeIdx) {
      status = 'done';
      data = doneData(key, (activeIdx - i) * 4 + 2);
    } else if (i === activeIdx) {
      status = 'open';
      data = openData(key);
    } else {
      status = 'waiting';
      data = {};
    }

    const doneAt  = status === 'done' ? iso(dAgo((activeIdx - i) * 4)) : null;
    const openAt  = status !== 'waiting' ? iso(dAgo((activeIdx - i) * 4 + 2)) : null;

    // stable ID: orderId prefix + stage index
    const stageId = `${orderId.slice(0, 28)}${String(i).padStart(4, '0')}`.slice(0, 36);

    return {
      id: stageId,
      organization_id: org,
      tenant_id: tenant,
      order_id: orderId,
      stage_key: key,
      status,
      responsible_user_id: null,
      responsible_name: null,
      data: JSON.stringify(data),
      hold_reason: null,
      hold_party: null,
      opened_at: openAt,
      completed_at: doneAt,
      completed_by_name: status === 'done' ? 'Team Lead' : null,
      created_at: iso(dAgo((activeIdx - i) * 4 + 5)),
      updated_at: iso(dAgo(1)),
    };
  });
}

/* ── orders config ───────────────────────────────────────────────────────── */

const ORDERS_CFG = [
  { id: U.o01,  no: 'DER/SO/FAKE/0001', cust: U.cust1, name: 'Glow & Shine Cosmetics',  status: 'booked',    daysBack: 3,  daysAhead: 60, mgr: 'Priya Sharma',  active: 'order',         pri: 'normal' },
  { id: U.o02,  no: 'DER/SO/FAKE/0002', cust: U.cust2, name: 'Luxe Beauty Labs',         status: 'confirmed', daysBack: 8,  daysAhead: 55, mgr: 'Priya Sharma',  active: 'advance',       pri: 'normal' },
  { id: U.o03,  no: 'DER/SO/FAKE/0003', cust: U.cust3, name: 'Natural Bliss Pvt Ltd',    status: 'confirmed', daysBack: 16, daysAhead: 50, mgr: 'Rahul Desai',   active: 'sampling',      pri: 'normal' },
  { id: U.o04,  no: 'DER/SO/FAKE/0004', cust: U.cust4, name: 'Bella Pharma Co',          status: 'confirmed', daysBack: 22, daysAhead: 45, mgr: 'Priya Sharma',  active: 'artwork',       pri: 'normal' },
  { id: U.o05,  no: 'DER/SO/FAKE/0005', cust: U.cust1, name: 'Glow & Shine Cosmetics',  status: 'confirmed', daysBack: 28, daysAhead: 35, mgr: 'Rahul Desai',   active: 'formulation',   pri: 'normal' },
  { id: U.o06,  no: 'DER/SO/FAKE/0006', cust: U.cust2, name: 'Luxe Beauty Labs',         status: 'confirmed', daysBack: 36, daysAhead: 25, mgr: 'Priya Sharma',  active: 'planning',      pri: 'high' },
  { id: U.o07,  no: 'DER/SO/FAKE/0007', cust: U.cust3, name: 'Natural Bliss Pvt Ltd',    status: 'confirmed', daysBack: 44, daysAhead: 18, mgr: 'Rahul Desai',   active: 'manufacturing', pri: 'high' },
  { id: U.o08,  no: 'DER/SO/FAKE/0008', cust: U.cust4, name: 'Bella Pharma Co',          status: 'confirmed', daysBack: 52, daysAhead: 12, mgr: 'Priya Sharma',  active: 'filling',       pri: 'normal' },
  { id: U.o09,  no: 'DER/SO/FAKE/0009', cust: U.cust1, name: 'Glow & Shine Cosmetics',  status: 'confirmed', daysBack: 60, daysAhead: 8,  mgr: 'Rahul Desai',   active: 'packing',       pri: 'normal' },
  { id: U.o10,  no: 'DER/SO/FAKE/0010', cust: U.cust2, name: 'Luxe Beauty Labs',         status: 'confirmed', daysBack: 68, daysAhead: 6,  mgr: 'Priya Sharma',  active: 'qc_qa',         pri: 'urgent' },
  { id: U.o11,  no: 'DER/SO/FAKE/0011', cust: U.cust3, name: 'Natural Bliss Pvt Ltd',    status: 'confirmed', daysBack: 76, daysAhead: 4,  mgr: 'Rahul Desai',   active: 'billing',       pri: 'normal' },
  { id: U.o12,  no: 'DER/SO/FAKE/0012', cust: U.cust4, name: 'Bella Pharma Co',          status: 'confirmed', daysBack: 84, daysAhead: 2,  mgr: 'Priya Sharma',  active: 'dispatch',      pri: 'urgent' },
];

const PROD_POOL = [
  { id: U.prod1, packSize: '100 ml', qty: '3000.000', rate: '95.00',  rdNo: 'RD/FAKE/001' },
  { id: U.prod2, packSize: '200 ml', qty: '2000.000', rate: '135.00', rdNo: 'RD/FAKE/002' },
  { id: U.prod3, packSize: '50 g',   qty: '5000.000', rate: '62.00',  rdNo: 'RD/FAKE/003' },
];

/* ── build all data ──────────────────────────────────────────────────────── */

function buildAll(tenant, org) {
  const T = {
    dermat_company_profiles: [],
    dermat_orders: [],
    dermat_order_lines: [],
    dermat_order_stages: [],
    dermat_order_events: [],
    dermat_order_payments: [],
    dermat_customer_registrations: [],
  };

  /* company profile */
  T.dermat_company_profiles.push({
    id: U.companyProfile,
    organization_id: org,
    tenant_id: tenant,
    name: 'Dermat India Pvt. Ltd.',
    legal_name: 'Dermat India Private Limited',
    gstin: '27AABCD1234E1Z5',
    pan: 'AABCD1234E',
    address: 'Plot 12, Industrial Area, Badlapur (E), Thane 421503, Maharashtra',
    phone: '+91 9876543210',
    email: 'accounts@dermatindia.com',
    website: 'www.dermatindia.com',
    bank_name: 'HDFC Bank',
    bank_branch: 'Badlapur Branch',
    bank_account: '50100123456789',
    bank_ifsc: 'HDFC0001234',
    upi_id: null,
    signatory: 'Rajesh Kumar',
    pi_terms: '40% advance, balance before dispatch. GST extra as applicable.',
    invoice_terms: 'Goods once sold will not be taken back. All disputes subject to Thane jurisdiction.',
    pi_validity_days: 15,
    grn_over_percent: 5,
    number_series: JSON.stringify({
      order:   { prefix: 'DER/SO/',  suffix: '', pad: 4, startAt: 1001 },
      pi:      { prefix: 'DER/PI/',  suffix: '', pad: 4, startAt: 1 },
      invoice: { prefix: 'DER/INV/', suffix: '', pad: 4, startAt: 1 },
      po:      { prefix: 'DER/PO/',  suffix: '', pad: 4, startAt: 1 },
      grn:     { prefix: 'DER/GRN/', suffix: '', pad: 4, startAt: 1 },
    }),
    form_options: JSON.stringify({ askCountry: true }),
    created_at: iso(dAgo(120)),
    updated_at: iso(dAgo(1)),
  });

  /* orders, lines, stages, events, payments */
  ORDERS_CFG.forEach((cfg, i) => {
    const prod = PROD_POOL[i % PROD_POOL.length];
    const activeIdx = idx(cfg.active);

    /* ── order ── */
    T.dermat_orders.push({
      id: cfg.id,
      organization_id: org,
      tenant_id: tenant,
      order_no: cfg.no,
      order_date: iso(dAgo(cfg.daysBack)),
      delivery_date: iso(dFwd(cfg.daysAhead)),
      customer_id: cfg.cust,
      customer_po_ref: `PO/FAKE/${cfg.no.slice(-4)}`,
      order_type: 'new',
      source_order_id: null,
      sales_manager: cfg.mgr,
      payment_terms: '30_days',
      payment_remarks: '40% advance, 60% before dispatch',
      product_remarks: 'As per approved sample.',
      billing_remarks: null,
      packing_remarks: '24 per shipper.',
      status: cfg.status,
      created_by_name: cfg.mgr,
      created_at: iso(dAgo(cfg.daysBack)),
      updated_at: iso(dAgo(1)),
      deleted_at: null,
      prices_include_gst: false,
      priority: cfg.pri,
      billing_address: null,
      shipping_address: null,
      revised_at: null,
      revised_by_name: null,
      revision_note: null,
    });

    /* ── order line ── */
    const lineId = `fa0000${String(i + 1).padStart(2,'0')}00-0000-4000-a000-line00000001`.slice(0, 36);
    T.dermat_order_lines.push({
      id: lineId,
      organization_id: org,
      tenant_id: tenant,
      order_id: cfg.id,
      position: 1,
      product_id: prod.id,
      brand_name: null,
      pack_size: prod.packSize,
      mrp: '499.00',
      quantity: prod.qty,
      rate: prod.rate,
      batch_no: `FK${String(i + 1001).padStart(4,'0')}`,
      specs: JSON.stringify({}),
      created_at: iso(dAgo(cfg.daysBack)),
      updated_at: iso(dAgo(cfg.daysBack)),
      gst_percent: '18.00',
      discount_percent: '0.00',
      sample_needed: true,
      rd_number: prod.rdNo,
    });

    /* ── stage rows ── */
    makeStageRows(cfg.id, cfg.active, org, tenant).forEach(row => {
      T.dermat_order_stages.push(row);
    });

    /* ── events (one per completed stage, plus step events) ── */
    ALL_STAGES.slice(1, activeIdx).forEach(sk => {
      const daysAgoN = (activeIdx - idx(sk)) * 4;
      T.dermat_order_events.push({
        organization_id: org,
        tenant_id: tenant,
        order_id: cfg.id,
        stage_key: sk,
        action: 'completed',
        note: `${sk} stage completed`,
        step_key: null,
        by_name: 'Team Lead',
        created_at: iso(dAgo(daysAgoN)),
      });
      // add a step_done event for each done step in that stage
      const data = doneData(sk, daysAgoN + 2);
      const steps = data.__steps || {};
      Object.entries(steps).forEach(([stepKey, stepData]) => {
        T.dermat_order_events.push({
          organization_id: org,
          tenant_id: tenant,
          order_id: cfg.id,
          stage_key: sk,
          action: 'step_done',
          note: stepKey.replace(/_/g, ' '),
          step_key: stepKey,
          by_name: stepData.by,
          created_at: stepData.at,
        });
      });
    });

    /* ── advance payment (for any order past advance stage) ── */
    if (activeIdx > idx('advance')) {
      T.dermat_order_payments.push({
        organization_id: org,
        tenant_id: tenant,
        order_id: cfg.id,
        order_no: cfg.no,
        kind: 'advance',
        amount: '25000.00',
        paid_on: dateFmt(dAgo(activeIdx * 4 - 2)),
        mode: 'bank_transfer',
        reference: `UTR${cfg.id.slice(-6).toUpperCase()}`,
        note: null,
        by_name: 'Accounts Team',
        voided_at: null,
        void_reason: null,
        invoice_id: null,
        invoice_code: null,
        history: null,
        created_at: iso(dAgo(activeIdx * 4 - 2)),
        updated_at: iso(dAgo(activeIdx * 4 - 2)),
      });
    }

    /* ── balance payment (billing / dispatch) ── */
    if (['billing', 'dispatch'].includes(cfg.active)) {
      T.dermat_order_payments.push({
        organization_id: org,
        tenant_id: tenant,
        order_id: cfg.id,
        order_no: cfg.no,
        kind: 'balance',
        amount: '62500.00',
        paid_on: dateFmt(dAgo(3)),
        mode: 'bank_transfer',
        reference: `UTR${cfg.id.slice(-6).toUpperCase()}BAL`,
        note: null,
        by_name: 'Accounts Team',
        voided_at: null,
        void_reason: null,
        invoice_id: null,
        invoice_code: null,
        history: null,
        created_at: iso(dAgo(3)),
        updated_at: iso(dAgo(3)),
      });
    }
  });

  /* ── customer registrations ── */
  T.dermat_customer_registrations.push({
    id: U.reg1,
    organization_id: org,
    tenant_id: tenant,
    token: 'FAKETOKEN_REG001_SUBMITTED',
    customer_id: U.cust1,
    status: 'submitted',
    answers: JSON.stringify({
      company_name: 'Glow & Shine Cosmetics',
      contact_name: 'Ananya Mehta',
      phone: '+91 9845612345',
      email: 'ananya@glowshine.com',
      gst_number: '27ABCDE1234F1Z1',
      address: 'Shop 4, Cosmetics Market, Navi Mumbai 400703',
      country: 'India',
    }),
    submitted_at: iso(dAgo(2)),
    ip: '192.168.1.100',
    decided_by_name: null,
    decided_at: null,
    note: null,
    created_by_name: 'Sales Team',
    created_at: iso(dAgo(5)),
    updated_at: iso(dAgo(2)),
  });

  T.dermat_customer_registrations.push({
    id: U.reg2,
    organization_id: org,
    tenant_id: tenant,
    token: 'FAKETOKEN_REG002_APPROVED',
    customer_id: U.cust2,
    status: 'approved',
    answers: JSON.stringify({
      company_name: 'Luxe Beauty Labs',
      contact_name: 'Vivek Joshi',
      phone: '+91 9765432109',
      email: 'vivek@luxebeautylabs.in',
      gst_number: '07FGHIJ5678K2Z9',
      address: '22 Okhla Industrial Estate, New Delhi 110020',
      country: 'India',
    }),
    submitted_at: iso(dAgo(10)),
    ip: '10.0.0.55',
    decided_by_name: 'Admin',
    decided_at: iso(dAgo(9)),
    note: 'Verified — KYC documents on file.',
    created_by_name: 'Sales Team',
    created_at: iso(dAgo(12)),
    updated_at: iso(dAgo(9)),
  });

  return T;
}

/* ── DB insert ───────────────────────────────────────────────────────────── */

async function insertRows(client, table, rows) {
  let inserted = 0;
  for (const row of rows) {
    const item = { ...row };
    for (const k of Object.keys(item)) {
      if (item[k] !== null && typeof item[k] === 'object' && !(item[k] instanceof Date)) {
        item[k] = JSON.stringify(item[k]);
      }
    }
    // rows without explicit 'id' → let DB auto-generate
    const keys = Object.keys(item).filter(k => !(k === 'id' && !item[k]));
    const values = keys.map(k => item[k]);
    const ph = keys.map((_, i) => `$${i + 1}`).join(', ');
    const cols = keys.map(k => `"${k}"`).join(', ');
    const sql = `INSERT INTO "${table}" (${cols}) VALUES (${ph}) ON CONFLICT DO NOTHING;`;
    try {
      const res = await client.query(sql, values);
      if (res.rowCount > 0) inserted++;
    } catch (err) {
      console.warn(`  ⚠ Skipped row in ${table}: ${err.message}`);
    }
  }
  return inserted;
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { tenantId: argT, organizationId: argO } = parseArgs();
  let tenant = argT, org = argO;

  if (!tenant || !org) {
    const res = await client.query("SELECT id, tenant_id FROM organizations WHERE name ILIKE '%Dermat%' LIMIT 1");
    if (res.rows.length > 0) {
      org = res.rows[0].id; tenant = res.rows[0].tenant_id;
      console.log(`Auto-detected Dermat org (${org}) tenant (${tenant})`);
    } else {
      const fb = await client.query('SELECT id, tenant_id FROM organizations LIMIT 1');
      if (!fb.rows.length) { console.error('❌ No organizations found.'); process.exit(1); }
      org = fb.rows[0].id; tenant = fb.rows[0].tenant_id;
      console.log(`Using default org (${org}) tenant (${tenant})`);
    }
  }

  const data = buildAll(tenant, org);

  await client.query('BEGIN');
  try {
    for (const table of [
      'dermat_company_profiles',
      'dermat_orders',
      'dermat_order_lines',
      'dermat_order_stages',
      'dermat_order_events',
      'dermat_order_payments',
      'dermat_customer_registrations',
    ]) {
      const list = data[table] || [];
      if (!list.length) continue;
      const n = await insertRows(client, table, list);
      console.log(`✓ [${table}]: ${n}/${list.length} rows inserted`);
    }
    await client.query('COMMIT');
    console.log('\n🎉 FAKE DERMAT SEED DATA INSERTED SUCCESSFULLY!');
    console.log('   12 orders — one at each of the 12 pipeline stages');
    console.log('   Every stage.data is fully populated so the UI renders correctly');
    console.log('   Step history, payments, events, company profile & registrations seeded');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
