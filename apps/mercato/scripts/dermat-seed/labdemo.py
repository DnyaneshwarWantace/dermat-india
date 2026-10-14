"""Demo R&D lab work (trials, formulas, lab results, stability, samples) and saved planning runs.
Runs after the demo orders, through the app's own API like the rest of the seed."""

import datetime
import itertools
import json
import os

from client import LOCK

TODAY = datetime.date.today()
COUNTER = itertools.count(1)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'products.json')) as handle:
    NAMES = {item['code']: item['name'] for kind in json.load(handle).values() for item in kind if item.get('code')}


def day(offset):
    return (TODAY + datetime.timedelta(days=offset)).isoformat()


def line(ids, code, percent, phase, function, balance=False):
    product_id = ids.get(code)
    return {
        'id': f'l{next(COUNTER)}',
        'phase': phase,
        'productId': product_id,
        'code': code if product_id else None,
        'name': NAMES.get(code, code),
        'function': function,
        'percent': percent,
        'isBalance': balance,
        'note': None,
    }


def serum(ids, extra_thickener=0.6):
    return [
        line(ids, 'RM-WAT-01', 0, 'A · Water phase', 'Solvent', balance=True),
        line(ids, 'RM-GLY-02', 3, 'A · Water phase', 'Humectant'),
        line(ids, 'RM-BUT-06', 2, 'A · Water phase', 'Humectant'),
        line(ids, 'ZG-007', 0.1, 'A · Water phase', 'Chelating agent'),
        line(ids, 'RM-THK-01', extra_thickener, 'A · Water phase', 'Thickener'),
        line(ids, 'RM-HYA-01', 0.2, 'C · Cool-down', 'Active'),
        line(ids, 'AP-018', 0.3, 'D · Actives', 'Active'),
        line(ids, 'ZG-006', 0.3, 'D · Actives', 'Active'),
        line(ids, 'AP-012', 2, 'D · Actives', 'Active'),
        line(ids, 'RM-PHN-01', 0.8, 'E · Fragrance and preservative', 'Preservative'),
    ]


def cream(ids):
    return [
        line(ids, 'RM-WAT-01', 0, 'A · Water phase', 'Solvent', balance=True),
        line(ids, 'RM-GLY-02', 4, 'A · Water phase', 'Humectant'),
        line(ids, 'ZG-007', 0.1, 'A · Water phase', 'Chelating agent'),
        line(ids, 'RM-CAR-04', 0.3, 'A · Water phase', 'Thickener'),
        line(ids, 'PROD-00001', 3, 'B · Oil phase', 'Emollient'),
        line(ids, 'AP-006', 2, 'B · Oil phase', 'Emollient'),
        line(ids, 'RM-TEA-07', 0.3, 'C · Cool-down', 'pH adjuster'),
        line(ids, 'AP-018', 0.5, 'D · Actives', 'Active'),
        line(ids, 'RM-HYA-01', 0.1, 'D · Actives', 'Active'),
        line(ids, 'RM-PHN-01', 0.8, 'E · Fragrance and preservative', 'Preservative'),
    ]


def face_wash(ids):
    return [
        line(ids, 'RM-WAT-01', 0, 'A · Water phase', 'Solvent', balance=True),
        line(ids, 'EP-186', 25, 'A · Water phase', 'Surfactant'),
        line(ids, 'RM-GLY-02', 3, 'A · Water phase', 'Humectant'),
        line(ids, 'RM-THK-01', 0.5, 'A · Water phase', 'Thickener'),
        line(ids, 'RM-SAL-01', 1, 'D · Actives', 'Active'),
        line(ids, 'AP-110', 1, 'D · Actives', 'Active'),
        line(ids, 'RM-TEA-07', 0.5, 'C · Cool-down', 'pH adjuster'),
        line(ids, 'ZG-007', 0.1, 'A · Water phase', 'Chelating agent'),
        line(ids, 'RM-PHN-01', 0.8, 'E · Fragrance and preservative', 'Preservative'),
    ]


class Lab:
    def __init__(self, api, ids):
        self.api = api
        self.ids = ids

    def request(self, label, body):
        status, res = self.api.call('POST', '/api/dermat_rnd/requests', body)
        return res if self.api.ok(f'R&D request {label}', status, res) else None

    def request_action(self, request_id, action, **extra):
        current = self.api.call('GET', f'/api/dermat_rnd/requests?id={request_id}')[1]
        status, res = self.api.call('POST', '/api/dermat_rnd/requests/action', {'id': request_id, 'action': action, **extra}, {LOCK: current['updatedAt']})
        self.api.ok(f"{current.get('code')} {action}", status, res)
        return res

    def trial(self, request_id, details, formula):
        status, created = self.api.call('POST', '/api/dermat_rnd/trials', {'requestId': request_id})
        if not self.api.ok('new trial', status, created):
            return None
        status, saved = self.api.call('PUT', '/api/dermat_rnd/trials', {'id': created['id'], 'batchUnit': 'g', 'formula': formula, **details}, {LOCK: created['updatedAt']})
        return saved if self.api.ok(f"{created['code']} formula", status, saved) else None

    def act(self, trial, action, **extra):
        if not trial:
            return None
        status, res = self.api.call('POST', '/api/dermat_rnd/trials/action', {'id': trial['id'], 'action': action, **extra}, {LOCK: trial['updatedAt']})
        return res if self.api.ok(f"{trial['code']} {action}", status, res) else trial

    def stability(self, trial, start_offset, conditions, checkpoints, readings, finish=None):
        trial = self.act(trial, 'start_stability', startDate=day(start_offset), conditions=conditions, checkpoints=checkpoints)
        for condition, checkpoint, values, result in readings:
            trial = self.act(trial, 'record_reading', condition=condition, day=checkpoint, readingDate=day(start_offset + checkpoint), values=values, result=result, remarks=None if result == 'pass' else 'Slight separation seen')
        if finish:
            trial = self.act(trial, 'finish_stability', result=finish[0], remarks=finish[1])
        return trial


def reading(ph, viscosity, appearance='Smooth, uniform', separation='No'):
    return {'Appearance': appearance, 'Colour': 'No change', 'Odour': 'No change', 'pH': ph, 'Viscosity (cps)': viscosity, 'Phase separation': separation}


def lab(api, driver):
    ids = driver.ids
    customers = driver.customers
    sampling = next((oid for oid, value in driver.state['orders'].items() if value['target'] == 'sampling'), None)
    lab = Lab(api, ids)
    conditions = ['45 °C', 'Room temperature', '4 °C']

    if 'Baebbe Mother & Baby Care LLP' in customers:
        req = lab.request('Baebbe serum', {'kind': 'client', 'customerId': customers['Baebbe Mother & Baby Care LLP'], 'orderId': sampling, 'productName': 'Baebbe Barrier Soothing Serum 30ml', 'brand': 'Baebbe', 'productType': 'Serum', 'packSize': '30 ml', 'sampleQty': '2 × 30 ml', 'ingredients': 'Ceramide complex if possible', 'texture': 'Light, non-sticky', 'textureReference': 'Like the current Cetaphil baby lotion', 'fragrance': 'Very mild', 'colour': 'Clear', 'targetPh': '5.0 – 5.5', 'claims': 'Paraben free, dermatologically tested', 'clientInstruction': 'Safe for baby skin, no strong smell.', 'dueDate': day(4), 'assignedName': 'R&D', 'ingredientRefs': [{'productId': ids[code], 'code': code, 'name': NAMES.get(code, code)} for code in ('AP-018', 'ZG-006', 'RM-HYA-01') if code in ids]})
        if req:
            first = lab.trial(req['id'], {'batchDate': day(-12), 'chemistName': 'R&D', 'batchSize': 500, 'aim': 'First trial from the client brief.', 'procedure': 'Disperse xanthan in water with glycerin, heat to 70 °C, cool to 40 °C, add actives and preservative.'}, serum(ids, extra_thickener=0.9))
            first = lab.act(first, 'submit')
            lab.act(first, 'record_result', values={'Description': 'Clear gel serum', 'Appearance': 'Clear', 'Colour': 'Colourless', 'Odour': 'Characteristic', 'Texture': 'Too thick, drags on skin', 'pH': '5.4', 'Viscosity (cps)': '9800'}, result='fail', remarks='Too thick for a serum. Cut xanthan to 0.6%.')
            second = lab.trial(req['id'], {'batchDate': day(-9), 'chemistName': 'R&D', 'batchSize': 500, 'aim': 'Xanthan 0.9% → 0.6% for a lighter feel.', 'procedure': 'Same as T1.'}, serum(ids))
            second = lab.act(second, 'submit')
            second = lab.act(second, 'record_result', values={'Description': 'Clear light serum', 'Appearance': 'Clear', 'Colour': 'Colourless', 'Odour': 'Characteristic', 'Texture': 'Light, non-sticky', 'pH': '5.3', 'Viscosity (cps)': '4200', 'Specific gravity': '1.02'}, result='pass', remarks='Matches the brief.')
            second = lab.act(second, 'approve')
            lab.stability(second, -8, conditions, [0, 7, 14, 30], [(condition, checkpoint, reading('5.3', '4200'), 'pass') for checkpoint in (0, 7) for condition in conditions])
            lab.request_action(req['id'], 'sample_sent', sentOn=day(-7), sentVia='Courier · DTDC D778213456', trialId=second['id'] if second else None)

    if 'Asvella Lifesciences Private Limited' in customers:
        req = lab.request('Asvella cream', {'kind': 'client', 'customerId': customers['Asvella Lifesciences Private Limited'], 'productName': 'Asvella Ceramide Barrier Repair Cream 50gm', 'brand': 'Asvella', 'productType': 'Cream', 'packSize': '50 gm', 'sampleQty': '2 × 50 gm', 'ingredients': 'Ceramide NP, hyaluronic acid', 'texture': 'Rich cream, quick absorbing', 'fragrance': 'Fragrance free', 'colour': 'White', 'targetPh': '5.5 – 6.0', 'clientInstruction': 'Compare with the sample the client sent.', 'dueDate': day(7), 'assignedName': 'R&D'})
        if req:
            first = lab.trial(req['id'], {'batchDate': day(-2), 'chemistName': 'R&D', 'batchSize': 1000, 'aim': 'First trial.', 'procedure': 'Oil and water phases at 75 °C, homogenise 10 min, neutralise with TEA below 40 °C.'}, cream(ids))
            lab.act(first, 'submit')

    lab_npd = lab.request('Tulsi face wash', {'kind': 'npd', 'productName': 'Tulsi Neem Anti-Acne Face Wash 100ml', 'productType': 'Face wash', 'packSize': '100 ml', 'ingredients': 'Tulsi ext 1%, salicylic acid 1%', 'texture': 'Gel', 'targetPh': '5.5', 'claims': 'Soap free', 'dueDate': day(14), 'assignedName': 'R&D'})
    if lab_npd:
        lab.trial(lab_npd['id'], {'batchDate': day(0), 'chemistName': 'R&D', 'batchSize': 1000, 'aim': 'Base formula for our own range.'}, face_wash(ids))

    if 'Hyeoskin Laboratories Pvt Ltd' in customers:
        req = lab.request('Hyeoskin serum (done)', {'kind': 'client', 'customerId': customers['Hyeoskin Laboratories Pvt Ltd'], 'productName': 'HYEO Bright Niacinamide 10% Serum', 'brand': 'HYEO', 'productType': 'Serum', 'packSize': '30 ml', 'ingredients': 'Niacinamide 10%, zinc PCA 1%', 'texture': 'Watery serum', 'fragrance': 'None', 'colour': 'Clear', 'targetPh': '5.5 – 6.5', 'dueDate': day(-40), 'assignedName': 'R&D'})
        if req:
            formula = [
                line(ids, 'RM-WAT-01', 0, 'A · Water phase', 'Solvent', balance=True),
                line(ids, 'RM-NIA-03', 10, 'D · Actives', 'Active'),
                line(ids, 'RM-ZNC-01', 1, 'D · Actives', 'Active'),
                line(ids, 'RM-GLY-02', 3, 'A · Water phase', 'Humectant'),
                line(ids, 'RM-THK-01', 0.3, 'A · Water phase', 'Thickener'),
                line(ids, 'ZG-007', 0.1, 'A · Water phase', 'Chelating agent'),
                line(ids, 'RM-PHN-01', 0.8, 'E · Fragrance and preservative', 'Preservative'),
            ]
            first = lab.trial(req['id'], {'batchDate': day(-62), 'chemistName': 'R&D', 'batchSize': 500, 'aim': 'Client brief.'}, formula)
            first = lab.act(first, 'submit')
            first = lab.act(first, 'record_result', values={'Description': 'Clear serum', 'Appearance': 'Clear', 'pH': '5.9', 'Viscosity (cps)': '1500'}, result='pass')
            first = lab.act(first, 'approve')
            readings = [(condition, checkpoint, reading('5.9', '1500'), 'pass') for checkpoint in (0, 7, 14, 30) for condition in conditions]
            lab.stability(first, -60, conditions, [0, 7, 14, 30], readings, finish=('pass', 'Stable at all conditions for 30 days.'))
            lab.request_action(req['id'], 'sample_sent', sentOn=day(-58), sentVia='Hand delivery', trialId=first['id'] if first else None)
            lab.request_action(req['id'], 'feedback', result='approved', feedback='Client approved texture and smell.')

    lab.request('Sunscreen NPD', {'kind': 'npd', 'productName': 'Ultra Matte Sunscreen SPF 50 Gel', 'productType': 'Sunscreen', 'packSize': '50 gm', 'ingredients': 'Tinosorb S, zinc oxide', 'texture': 'Matte gel', 'claims': 'No white cast', 'dueDate': day(21), 'assignedName': 'R&D'})


def plans(api, driver):
    open_orders = [oid for oid, value in driver.state['orders'].items() if value['target'] in ('planning', 'formulation', 'artwork', 'manufacturing', 'sampling')]
    picks = []
    for oid in open_orders:
        order = driver.order(oid)
        for item in order.get('lines', []):
            picks.append({'key': item['id'], 'orderId': oid, 'lineId': item['id'], 'productId': item['productId'], 'quantity': item['quantity'], 'no': order.get('orderNo')})
    if not picks:
        print('  skipped planning runs: no open orders to plan')
        return
    groups = [
        ('Week 42 · creams and serums', picks[:2], 'ready', 'Mixing vessel V-3 booked Mon–Wed.'),
        ('Week 43 · sunscreens', picks[2:4], 'preparing', 'Store to keep zinc and Tinosorb ready.'),
        ('Week 44 · draft', picks[4:6], None, 'Waiting for artwork approval on one order.'),
    ]
    for offset, (name, items, store_state, notes) in enumerate(groups):
        if not items:
            continue
        body = {'name': name, 'notes': notes, 'items': [{key: item[key] for key in ('key', 'orderId', 'lineId', 'productId', 'quantity')} for item in items]}
        status, plan = api.call('POST', '/api/dermat_planning/plans', body)
        if not api.ok(f'plan {name}', status, plan) or not store_state:
            continue
        status, sent = api.call('POST', '/api/dermat_planning/plans/send', {'id': plan['id'], 'prepareBy': day(2 + offset * 3), 'note': 'Please keep everything ready by this date.'}, {LOCK: plan['updatedAt']})
        if not api.ok(f'send {name}', status, sent):
            continue
        status, stored = api.call('POST', '/api/dermat_planning/plans/store', {'id': plan['id'], 'status': store_state, 'note': 'All RM issued to production.' if store_state == 'ready' else 'Picking started.'}, {LOCK: sent['updatedAt']})
        api.ok(f'store {name}', status, stored)


BILLED = ('billing', 'dispatched', 'done')
TRANSPORT = [('VRL Logistics', 'MH12 KT 4471'), ('Gati Ltd', 'MH14 GD 2209'), ('Safexpress', 'MH12 RN 8831'), ('Blue Dart', 'MH04 JK 1190')]


def accounts(api, driver):
    for n, (oid, meta) in enumerate(driver.state['orders'].items()):
        if meta['target'] == 'cancelled':
            continue
        order_day = day(meta.get('offset', 0))
        status, pi = api.call('POST', '/api/dermat_accounts/proformas', {'orderId': oid, 'piDate': order_day, 'validUntil': day(meta.get('offset', 0) + 15), 'advancePercent': 40, 'notes': 'Advance 40% to confirm the order; balance before dispatch.'})
        if not api.ok(f"PI for {meta['no']}", status, pi):
            continue
        api.ok(f"send PI {meta['no']}", *api.call('POST', '/api/dermat_accounts/proformas/action', {'id': pi['id'], 'action': 'send'}, {LOCK: pi['updatedAt']}))
        if meta['target'] not in BILLED:
            continue
        status, invoice = api.call('POST', '/api/dermat_accounts/invoices', {'orderId': oid, 'invoiceDate': day(meta.get('offset', 0) + 17), 'notes': 'Goods as per sale order.'})
        if not api.ok(f"invoice for {meta['no']}", status, invoice):
            continue
        if meta['target'] in ('dispatched', 'done'):
            transporter, vehicle = TRANSPORT[n % len(TRANSPORT)]
            status, invoice = api.call('PUT', '/api/dermat_accounts/invoices', {'id': invoice['id'], 'transporter': transporter, 'vehicleNo': vehicle, 'lrNo': f'LR{48210 + n * 37}', 'ewayBillNo': f'3512{608840 + n * 11}'}, {LOCK: invoice['updatedAt']})
            if not api.ok(f"transport on {meta['no']}", status, invoice):
                continue
        status, issued = api.call('POST', '/api/dermat_accounts/invoices/action', {'id': invoice['id'], 'action': 'issue'}, {LOCK: invoice['updatedAt']})
        api.ok(f"issue invoice {meta['no']}", status, issued)
        if meta['target'] == 'done' and n == 2 and api.ok('issued', status, issued):
            first_line = (issued.get('lines') or [{}])[0]
            if first_line.get('orderLineId'):
                api.ok('credit note', *api.call('POST', '/api/dermat_accounts/invoices/action', {'id': issued['id'], 'action': 'credit_note', 'reason': '50 pcs damaged in transit, returned by client', 'lines': [{'orderLineId': first_line['orderLineId'], 'quantity': 50}]}, {LOCK: issued['updatedAt']}))


QA_DOCS = [
    ('SOP/QA/001', 'Line clearance before filling and packing', 'SOP', 'QA', -200, 165),
    ('SOP/QA/002', 'Batch release and retention samples', 'SOP', 'QA', -180, 185),
    ('SOP/PRD/004', 'Cleaning of mixing vessels V-1 to V-4', 'SOP', 'Production', -150, 215),
    ('QR/QC/010', 'Bulk testing report format', 'QR format', 'QC', -120, 245),
    ('IPQC/PKG/003', 'In-process checks during packing', 'IPQC format', 'Packing', -100, 12),
    ('SPEC/RM/021', 'Specification: Niacinamide IP', 'Specification', 'QC', -90, 275),
    ('TM/QC/007', 'Test method: viscosity by Brookfield', 'Test method', 'QC', -60, 305),
    ('POL/QA/001', 'Artwork approval policy', 'Policy', 'QA', -40, 325),
]


def qa_documents(api):
    for doc_no, title, doc_type, department, effective, review in QA_DOCS:
        api.ok(f'QA doc {doc_no}', *api.call('POST', '/api/dermat_quality/documents', {'docNo': doc_no, 'title': title, 'docType': doc_type, 'department': department, 'effectiveDate': day(effective), 'reviewDate': day(review), 'notes': None}))


def live_queues(api, driver):
    ids = driver.ids
    vendors = driver.vendors
    pick = lambda name: vendors.get(name) or next(iter(vendors.values()))
    pos = [
        ('Keshava Organics & Chemicals Ltd', [('RM-GLY-02', 50, 140), ('RM-NIA-03', 25, 980)], 'draft', 'Next month creams, check rates first.'),
        ('Vardhman Glass & Containers', [('PM-BOT-30ML', 6000, 14.5)], 'submit', 'Bottles for the November serum orders.'),
        ('Lonza India Pvt Ltd', [('RM-CAR-04', 25, 1250), ('RM-PHN-01', 20, 650)], 'approve', 'Urgent: needed before the 20th.'),
    ]
    for vendor, items, state, notes in pos:
        lines = [{'productId': ids[code], 'quantity': qty, 'rate': rate, 'gstPercent': 18} for code, qty, rate in items if code in ids]
        if not lines:
            continue
        status, po = api.call('POST', '/api/dermat_purchase/orders', {'vendorId': pick(vendor), 'poDate': day(-1), 'expectedDate': day(7), 'submit': state != 'draft', 'notes': notes, 'terms': '30 days from GRN', 'lines': lines})
        if not api.ok(f'live PO {vendor}', status, po) or state != 'approve':
            continue
        view = api.call('GET', f"/api/dermat_purchase/orders?id={po['id']}")[1]
        api.ok('approve live PO', *api.call('POST', '/api/dermat_purchase/orders/approve', {'id': po['id']}, {LOCK: view['updatedAt']}))

    targets = [(oid, meta['target']) for oid, meta in driver.state['orders'].items() if meta['target'] in ('manufacturing', 'filling')]
    for n, (oid, stage_key) in enumerate(targets[:2]):
        extra_code = 'RM-GLY-02' if stage_key == 'manufacturing' else 'PM-LBL-01'
        if extra_code not in ids:
            continue
        status, res = api.call('POST', '/api/dermat_store/requests', {'orderId': oid, 'stageKey': stage_key, 'lines': [{'productId': ids[extra_code], 'quantity': 2 if stage_key == 'manufacturing' else 200}], 'notes': 'Top-up: a little more needed than planned.'})
        if not api.ok(f'live store request {stage_key}', status, res) or n == 0:
            continue
        for item in res.get('items', []):
            req = api.call('GET', f"/api/dermat_store/requests?id={item['id']}")[1]
            api.ok('issue live request', *api.call('POST', '/api/dermat_store/requests/issue', {'id': req['id'], 'lines': [{'lineId': line['id'], 'quantity': line['required']} for line in req['lines']]}, {LOCK: req['updatedAt']}))
