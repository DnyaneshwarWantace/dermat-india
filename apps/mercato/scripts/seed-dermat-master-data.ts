import { Client } from 'pg'
import crypto from 'node:crypto'
import dotenv from 'dotenv'

dotenv.config({ path: '/Users/dnyaneshwarwantace/Downloads/Wantace-projects/wantace-testiing/apps/mercato/.env' })

const secret = process.env.TENANT_DATA_ENCRYPTION_FALLBACK_KEY || 'wantace-erp-dev-encryption-key-32chars!!'
const root = crypto.createHash('sha256').update(secret).digest()

function getDek(tenantId: string): string {
  const derived = crypto.pbkdf2Sync(root, tenantId, 310000, 32, 'sha512')
  return derived.toString('base64')
}

function encryptVal(value: string | null | undefined, dekBase64: string): string | null {
  if (!value) return null
  const dek = Buffer.from(dekBase64, 'base64')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${ciphertext.toString('base64')}:${tag.toString('base64')}:v1`
}

function decryptVal(payload: string | null | undefined, dekBase64: string): string | null {
  if (!payload || typeof payload !== 'string' || !payload.includes(':')) return payload ?? null
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[3] !== 'v1') return payload
  const [ivB64, ciphertextB64, tagB64] = parts
  try {
    const dek = Buffer.from(dekBase64, 'base64')
    const iv = Buffer.from(ivB64, 'base64')
    const ciphertext = Buffer.from(ciphertextB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    return payload
  }
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  console.log('Connected to PostgreSQL database.')

  // 1. Get organization and tenant IDs
  const orgRes = await client.query('SELECT organization_id, tenant_id FROM catalog_products LIMIT 1')
  const orgId = orgRes.rows[0]?.organization_id || 'acda023f-0e22-46ab-86e6-2017541920e3'
  const tenantId = orgRes.rows[0]?.tenant_id || '3fd4ca56-1c41-408f-82af-7ff13dcfaf58'
  const dek = getDek(tenantId)

  console.log(`Using Org ID: ${orgId}, Tenant ID: ${tenantId}`)

  // 2. Clean up invalid / test records
  console.log('\nCleaning up old test / orphan orders, invalid products, and invalid customer entries...')
  await client.query("DELETE FROM sales_order_lines WHERE order_id IN (SELECT id FROM sales_orders WHERE grand_total_gross_amount = '0.0000' OR order_number LIKE '%test%')")
  await client.query("DELETE FROM sales_orders WHERE grand_total_gross_amount = '0.0000' OR order_number LIKE '%test%'")
  
  // Clean up products with null SKU or test entries
  await client.query("DELETE FROM catalog_products WHERE sku IS NULL OR title = 'test' OR title LIKE '%test%'")
  
  // Clean up corrupted / wrongly named customer entities (like 'Baebbe Serum 30ml')
  const allCe = await client.query('SELECT id, display_name FROM customer_entities')
  for (const r of allCe.rows) {
    const dec = decryptVal(r.display_name, dek)
    if (dec && (dec.toLowerCase().includes('serum') || dec.toLowerCase().includes('test') || dec.toLowerCase().includes('product'))) {
      console.log(`Removing invalid customer entity: "${dec}" (${r.id})`)
      await client.query('DELETE FROM customer_addresses WHERE entity_id = $1', [r.id])
      await client.query('DELETE FROM customer_companies WHERE entity_id = $1 OR id = $1', [r.id])
      await client.query('DELETE FROM sales_orders WHERE customer_entity_id = $1', [r.id])
      await client.query('DELETE FROM custom_field_values WHERE record_id = $1', [r.id])
      await client.query('DELETE FROM customer_entities WHERE id = $1', [r.id])
    }
  }

  // 3. Define Standard 10 Customers with complete company, address, GSTIN and contact details
  const standardCustomers = [
    { name: 'Mishkae', legal: 'Mishkae Wellness Pvt Ltd', phone: '+91 98201 12345', email: 'orders@mishkae.com', gstin: '27AABCM1234F1Z8', poc: 'Vikram Mehta', city: 'Mumbai', state: 'Maharashtra', address: 'Plot 42, MIDC Andheri East, Mumbai 400093', zip: '400093' },
    { name: 'Bioinovex Health', legal: 'Bioinovex Health Labs LLP', phone: '+91 98450 67890', email: 'procurement@bioinovex.com', gstin: '29AABCB5678G1ZP', poc: 'Dr. Ananya Rao', city: 'Bengaluru', state: 'Karnataka', address: '88 Electronic City Phase 1, Bengaluru 560100', zip: '560100' },
    { name: 'Sereneaura Sciences', legal: 'Sereneaura Sciences Pvt Ltd', phone: '+91 98110 54321', email: 'supply@sereneaura.com', gstin: '07AABCS9012H1ZU', poc: 'Rohit Sharma', city: 'New Delhi', state: 'Delhi', address: 'B-12 Okhla Industrial Area Phase 2, New Delhi 110020', zip: '110020' },
    { name: 'Skin Theta Global', legal: 'Skin Theta Global Care LLP', phone: '+91 97690 98765', email: 'business@skintheta.com', gstin: '27AABCS3456J1ZR', poc: 'Priya Iyer', city: 'Pune', state: 'Maharashtra', address: 'Hinjewadi Tech Park Phase 3, Pune 411057', zip: '411057' },
    { name: 'Myndful Global', legal: 'Myndful Personal Care Ltd', phone: '+91 99000 11223', email: 'ops@myndfulglobal.com', gstin: '24AABCM7890K1ZW', poc: 'Amit Patel', city: 'Ahmedabad', state: 'Gujarat', address: 'SG Highway Titanium City Center, Ahmedabad 380054', zip: '380054' },
    { name: 'Rudra Enterprises', legal: 'Rudra Enterprises & Derma', phone: '+91 94120 33445', email: 'rudra.derma@gmail.com', gstin: '09AABCR1122L1ZX', poc: 'Rajesh Gupta', city: 'Noida', state: 'Uttar Pradesh', address: 'Sector 63 Commercial Complex, Noida 201301', zip: '201301' },
    { name: 'Hyeoskin', legal: 'Hyeoskin Laboratories Pvt Ltd', phone: '+91 98840 99887', email: 'orders@hyeoskin.in', gstin: '33AABCH3344M1ZV', poc: 'Karthik Raja', city: 'Chennai', state: 'Tamil Nadu', address: 'Guindy Industrial Estate, Chennai 600032', zip: '600032' },
    { name: 'Heal n Cure', legal: 'Heal n Cure Healthcare Ltd', phone: '+91 98720 55667', email: 'pharma@healncure.com', gstin: '03AABCH5566N1ZT', poc: 'Harpreet Singh', city: 'Chandigarh', state: 'Punjab', address: 'Industrial Area Phase 1, Chandigarh 160002', zip: '160002' },
    { name: 'Baebbe Skin Care', legal: 'Baebbe Mother & Baby Care LLP', phone: '+91 98300 77889', email: 'hello@baebbe.com', gstin: '19AABCB7788P1ZS', poc: 'Sneha Bose', city: 'Kolkata', state: 'West Bengal', address: 'Salt Lake Sector V, Kolkata 700091', zip: '700091' },
    { name: 'Miganz K', legal: 'Miganz K Cosmetics India', phone: '+91 98490 22334', email: 'contact@miganzk.com', gstin: '36AABCM9900Q1ZR', poc: 'Suresh Reddy', city: 'Hyderabad', state: 'Telangana', address: 'HITEC City Madhapur, Hyderabad 500081', zip: '500081' },
  ]

  console.log(`\nUpserting ${standardCustomers.length} standard customer records with encrypted PII & linked profiles...`)
  const customerMap = new Map<string, { entityId: string; legal: string; phone: string; email: string; gstin: string; poc: string; city: string; state: string; address: string; zip: string }>()

  for (const c of standardCustomers) {
    const encName = encryptVal(c.name, dek)
    const encLegal = encryptVal(c.legal, dek)
    const encPhone = encryptVal(c.phone, dek)
    const encEmail = encryptVal(c.email, dek)

    // Check existing entity
    const existingEntities = await client.query('SELECT id, display_name FROM customer_entities')
    let entityId: string | null = null
    for (const r of existingEntities.rows) {
      const dec = decryptVal(r.display_name, dek)
      if (dec && dec.toLowerCase().trim() === c.name.toLowerCase().trim()) {
        entityId = r.id
        break
      }
    }

    if (!entityId) {
      entityId = crypto.randomUUID()
      await client.query(
        `INSERT INTO customer_entities (id, organization_id, tenant_id, kind, display_name, primary_email, primary_phone, status, source, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'company', $4, $5, $6, 'active', 'referral', true, NOW(), NOW())`,
        [entityId, orgId, tenantId, encName, encEmail, encPhone]
      )
    } else {
      await client.query(
        `UPDATE customer_entities SET display_name = $1, primary_email = $2, primary_phone = $3, status = 'active', source = 'referral', is_active = true, updated_at = NOW() WHERE id = $4`,
        [encName, encEmail, encPhone, entityId]
      )
    }

    customerMap.set(c.name, { entityId, ...c })

    // Upsert company profile
    const compCheck = await client.query('SELECT id FROM customer_companies WHERE entity_id = $1', [entityId])
    if (compCheck.rows.length === 0) {
      const compId = crypto.randomUUID()
      await client.query(
        `INSERT INTO customer_companies (id, organization_id, tenant_id, entity_id, legal_name, brand_name, industry, size_bucket, annual_revenue, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Cosmetics & Dermatology', 'mid-market', 5000000, NOW(), NOW())`,
        [compId, orgId, tenantId, entityId, encLegal, encName]
      )
    } else {
      await client.query(
        `UPDATE customer_companies SET legal_name = $1, brand_name = $2, industry = 'Cosmetics & Dermatology', size_bucket = 'mid-market', annual_revenue = 5000000, updated_at = NOW() WHERE entity_id = $3`,
        [encLegal, encName, entityId]
      )
    }

    // Upsert customer address
    const addrCheck = await client.query('SELECT id FROM customer_addresses WHERE entity_id = $1', [entityId])
    const encAddr1 = encryptVal(c.address, dek)
    const encCity = encryptVal(c.city, dek)
    const encRegion = encryptVal(c.state, dek)
    const encZip = encryptVal(c.zip, dek)
    const encCompName = encryptVal(c.legal, dek)

    if (addrCheck.rows.length === 0) {
      const addrId = crypto.randomUUID()
      await client.query(
        `INSERT INTO customer_addresses (id, organization_id, tenant_id, entity_id, name, purpose, address_line1, city, region, postal_code, country, company_name, is_primary, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'Headquarters', 'billing', $5, $6, $7, $8, 'IN', $9, true, NOW(), NOW())`,
        [addrId, orgId, tenantId, entityId, encAddr1, encCity, encRegion, encZip, encCompName]
      )
    } else {
      await client.query(
        `UPDATE customer_addresses SET address_line1 = $1, city = $2, region = $3, postal_code = $4, company_name = $5, is_primary = true, updated_at = NOW() WHERE entity_id = $6`,
        [encAddr1, encCity, encRegion, encZip, encCompName, entityId]
      )
    }
  }

  // 4. Define Standard Catalog Products with complete info & variants
  const standardProducts = [
    {
      sku: 'MISH-SER-30',
      title: 'Mishkae Serum',
      category: 'Face Serum',
      uom: 'gm',
      pack: '30',
      mrp: 799,
      rate: 195,
      brand: 'Mishkae',
      desc: 'Active brightening and barrier repair face serum with 10% Niacinamide and Zinc PCA',
      variants: [
        { sku: 'MISH-SER-30', name: '30gm Standard Pack', pack: '30', uom: 'gm', mrp: 799, rate: 195, isDefault: true },
        { sku: 'MISH-SER-50', name: '50gm Value Pack', pack: '50', uom: 'gm', mrp: 1199, rate: 285, isDefault: false },
        { sku: 'MISH-SER-100', name: '100gm Salon Pack', pack: '100', uom: 'gm', mrp: 2199, rate: 490, isDefault: false },
      ]
    },
    { sku: 'MISH-SUN-50', title: 'Mishkae Sunscreen SPF50 50gm', category: 'Sunscreen', uom: 'gm', pack: '50', mrp: 699, rate: 165, brand: 'Mishkae', desc: 'Broad spectrum matte gel sunscreen with micronized zinc oxide and SPF 50 PA++++' },
    { sku: 'DERM-UVSTK-20', title: 'Dermapia Uvipia Sunscreen Stick 20gm', category: 'Sunscreen', uom: 'gm', pack: '20', mrp: 850, rate: 220, brand: 'Mishkae', desc: 'Easy glide portable on-the-go UV protection stick' },
    { sku: 'DERM-UVZINC-50', title: 'Dermapia Uvipia Zinc Mineral Fluid Sunscreen 50ml', category: 'Sunscreen', uom: 'ml', pack: '50', mrp: 990, rate: 240, brand: 'Bioinovex Health', desc: '100% Mineral sheer fluid sunscreen with zinc & ceramides' },
    { sku: 'SERA-CAPCR-55', title: 'Sereneaura Capsule Cream 55gm', category: 'Cream', uom: 'gm', pack: '55', mrp: 1200, rate: 290, brand: 'Sereneaura Sciences', desc: 'Nourishing encapsulated barrier hydration gel-cream' },
    {
      sku: 'SERA-REESER-30',
      title: 'Sereneaura Reedle Serum',
      category: 'Face Serum',
      uom: 'ml',
      pack: '30',
      mrp: 1450,
      rate: 350,
      brand: 'Sereneaura Sciences',
      desc: 'Advanced micro-spicule collagen stimulating peptide serum',
      variants: [
        { sku: 'SERA-REESER-30', name: '30ml Dropper Bottle', pack: '30', uom: 'ml', mrp: 1450, rate: 350, isDefault: true },
        { sku: 'SERA-REESER-50', name: '50ml Clinic Pack', pack: '50', uom: 'ml', mrp: 2250, rate: 520, isDefault: false },
      ]
    },
    { sku: 'SKTH-PDRN-30', title: 'Skintheta PDRN Salmon DNA Serum 30ml', category: 'Face Serum', uom: 'ml', pack: '30', mrp: 1800, rate: 420, brand: 'Skin Theta Global', desc: 'Cellular rejuvenation PDRN serum for deep tissue repair' },
    { sku: 'SKTH-EXO-30', title: 'Skintheta Exosome Regenerative Cream 30gm', category: 'Cream', uom: 'gm', pack: '30', mrp: 1950, rate: 460, brand: 'Skin Theta Global', desc: 'Plant exosome elasticity firming moisturizer' },
    {
      sku: 'NEUR-CLNS-100',
      title: 'NeuroCalm Gentle Foaming Cleanser',
      category: 'Face Wash',
      uom: 'ml',
      pack: '100',
      mrp: 499,
      rate: 120,
      brand: 'Myndful Global',
      desc: 'Sulfate-free oat & ceramide microbiome soothing cleanser',
      variants: [
        { sku: 'NEUR-CLNS-100', name: '100ml Pump Bottle', pack: '100', uom: 'ml', mrp: 499, rate: 120, isDefault: true },
        { sku: 'NEUR-CLNS-200', name: '200ml Refill Pack', pack: '200', uom: 'ml', mrp: 849, rate: 195, isDefault: false },
      ]
    },
    { sku: 'NEUR-MOIST-50', title: 'NeuroHydrate Daily Gel Moisturiser 50gm', category: 'Gel', uom: 'gm', pack: '50', mrp: 650, rate: 155, brand: 'Myndful Global', desc: 'Oil-free lightweight squalane hydration booster' },
    { sku: 'NEUR-DAYSER-30', title: 'NeuroLift Day Defense Peptide Serum 30ml', category: 'Face Serum', uom: 'ml', pack: '30', mrp: 899, rate: 210, brand: 'Myndful Global', desc: 'Matrixyl 3000 antioxidant day protective serum' },
    { sku: 'HYEO-REPCR-30', title: 'HYEO Bright Barrier Repair Cream 30gm', category: 'Cream', uom: 'gm', pack: '30', mrp: 750, rate: 185, brand: 'Hyeoskin', desc: 'Cica and Panthenol intense post-treatment recovery cream' },
    {
      sku: 'HYEO-SER-30',
      title: 'HYEO Bright Niacinamide 10% Serum',
      category: 'Face Serum',
      uom: 'ml',
      pack: '30',
      mrp: 699,
      rate: 170,
      brand: 'Hyeoskin',
      desc: 'Pore refining 10% Niacinamide and 1% Zinc PCA serum',
      variants: [
        { sku: 'HYEO-SER-30', name: '30ml Standard Dropper', pack: '30', uom: 'ml', mrp: 699, rate: 170, isDefault: true },
        { sku: 'HYEO-SER-60', name: '60ml Twin Pack', pack: '60', uom: 'ml', mrp: 1199, rate: 280, isDefault: false },
      ]
    },
    {
      sku: 'NGGL-DAYCR-60',
      title: 'NG Glow Daily Brightening Face Day Cream',
      category: 'Cream',
      uom: 'gm',
      pack: '60',
      mrp: 550,
      rate: 140,
      brand: 'Rudra Enterprises',
      desc: 'Alpha-Arbutin daylight radiance cream SPF 20',
      variants: [
        { sku: 'NGGL-DAYCR-60', name: '60gm Daily Jar', pack: '60', uom: 'gm', mrp: 550, rate: 140, isDefault: true },
        { sku: 'NGGL-DAYCR-100', name: '100gm Value Jar', pack: '100', uom: 'gm', mrp: 850, rate: 210, isDefault: false },
      ]
    },
    { sku: 'NGGL-NIGHTCR-30', title: 'NG Glow Plus XT Retinol Night Cream 30gm', category: 'Cream', uom: 'gm', pack: '30', mrp: 799, rate: 195, brand: 'Rudra Enterprises', desc: 'Encapsulated 0.3% Retinol night repair emulsion' },
    { sku: 'NGGL-FW-60', title: 'NG Glow Salicylic 2% Face Wash 60ml', category: 'Face Wash', uom: 'ml', pack: '60', mrp: 350, rate: 85, brand: 'Rudra Enterprises', desc: 'Exfoliating anti-acne 2% Salicylic Acid foaming wash' },
    { sku: 'BAEB-FW-100', title: 'Baebbe Hydrating Milk Cleanser 100ml', category: 'Face Wash', uom: 'ml', pack: '100', mrp: 450, rate: 110, brand: 'Baebbe Skin Care', desc: 'Mild prebiotic baby & sensitive skin cleansing milk' },
    { sku: 'BAEB-SER-30', title: 'Baebbe Barrier Soothing Serum 30ml', category: 'Face Serum', uom: 'ml', pack: '30', mrp: 650, rate: 160, brand: 'Baebbe Skin Care', desc: 'Centella Asiatica and Hyaluronic acid deep moisture drops' },
    { sku: 'ZITL-GEL-25', title: 'Zitlite Rapid Acne Spot Gel 25gms', category: 'Gel', uom: 'gm', pack: '25', mrp: 420, rate: 105, brand: 'Heal n Cure', desc: 'Targeted spot treatment gel with Tea Tree & Zinc' },
    { sku: 'VITC-SER-30', title: 'Vitamin C 15% Glow Face Serum 30ml', category: 'Face Serum', uom: 'ml', pack: '30', mrp: 699, rate: 175, brand: 'Bioinovex Health', desc: 'Pure 15% L-Ascorbic Acid and Ferulic Acid antioxidant formulation' },
    { sku: 'MIG-PEEL-50', title: 'Miganz K AHA 30% + BHA 2% Peeling Solution 50ml', category: 'Face Serum', uom: 'ml', pack: '50', mrp: 890, rate: 215, brand: 'Miganz K', desc: 'Professional chemical exfoliation peeling solution' },
  ]

  console.log(`\nUpserting ${standardProducts.length} standard catalog products with variants & custom fields...`)
  const productDbMap = new Map<string, string>() // sku -> id
  const variantListForOrders: Array<{ product: typeof standardProducts[0]; variant: { sku: string; name: string; pack: string; uom: string; mrp: number; rate: number } }> = []

  for (const p of standardProducts) {
    const custInfo = customerMap.get(p.brand)
    const custEntityId = custInfo?.entityId || ''
    const prodMeta = {
      is_make_to_order: true,
      customer_id: custEntityId,
      customer_name: p.brand,
      client_brand: p.brand,
      customer: p.brand,
      product_code: p.sku,
      category: p.category,
      pack_size: `${p.pack} ${p.uom}`,
      pack: p.pack,
      mrp: `₹${p.mrp}`,
      mrp_num: p.mrp,
      base_uom: p.uom,
      uom: p.uom,
      min_floor_qty: 500,
    }

    const existing = await client.query('SELECT id FROM catalog_products WHERE sku = $1', [p.sku])
    let prodId: string
    if (existing.rows.length > 0) {
      prodId = existing.rows[0].id
      await client.query(
        `UPDATE catalog_products SET title = $1, description = $2, is_active = true, metadata = $3, updated_at = NOW() WHERE sku = $4`,
        [p.title, p.desc, JSON.stringify(prodMeta), p.sku]
      )
    } else {
      prodId = crypto.randomUUID()
      await client.query(
        `INSERT INTO catalog_products (id, organization_id, tenant_id, title, description, sku, is_active, product_type, requires_shipping, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, 'simple', true, $7, NOW(), NOW())`,
        [prodId, orgId, tenantId, p.title, p.desc, p.sku, JSON.stringify(prodMeta)]
      )
    }
    productDbMap.set(p.sku, prodId)

    // Clean up duplicate custom_field_defs
    await client.query(`DELETE FROM custom_field_defs WHERE entity_id = 'catalog:catalog_product' AND key IN ('company', 'customer_name', 'client_brand', 'internal_id', 'gst_tax_category')`)
    await client.query(`DELETE FROM custom_field_values WHERE entity_id = 'catalog:catalog_product' AND field_key IN ('company', 'customer_name', 'client_brand')`)

    // Upsert custom_field_values for catalog:catalog_product
    const cfEntries = [
      { key: 'product_code', label: 'Product Code', val: p.sku, prio: 1 },
      { key: 'category', label: 'Category', val: p.category, prio: 2 },
      { key: 'customer', label: 'Customer', val: p.brand, prio: 3 },
      { key: 'pack_size', label: 'Pack Size', val: `${p.pack} ${p.uom}`, prio: 4 },
      { key: 'mrp', label: 'M.R.P. (₹)', val: `₹${p.mrp}`, prio: 5 },
      { key: 'min_floor_qty', label: 'Min Floor Qty', val: '500', prio: 6 },
      { key: 'base_uom', label: 'Base UOM', val: p.uom, prio: 7 },
    ]

    // Ensure custom_field_defs exist for all keys
    for (const entry of cfEntries) {
      const defCheck = await client.query(
        `SELECT id FROM custom_field_defs WHERE entity_id = 'catalog:catalog_product' AND key = $1`,
        [entry.key]
      )
      const cfg = { label: entry.label, priority: entry.prio, listVisible: true, filterable: true, formEditable: true }
      if (defCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO custom_field_defs (id, organization_id, tenant_id, entity_id, key, kind, config_json, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, 'catalog:catalog_product', $4, 'text', $5, true, NOW(), NOW())`,
          [crypto.randomUUID(), orgId, tenantId, entry.key, JSON.stringify(cfg)]
        )
      } else {
        await client.query(
          `UPDATE custom_field_defs SET is_active = true, config_json = $1, organization_id = $2, tenant_id = $3, updated_at = NOW() WHERE id = $4`,
          [JSON.stringify(cfg), orgId, tenantId, defCheck.rows[0].id]
        )
      }
    }

    for (const entry of cfEntries) {
      const cfCheck = await client.query(
        `SELECT id FROM custom_field_values WHERE entity_id = 'catalog:catalog_product' AND record_id = $1 AND field_key = $2`,
        [prodId, entry.key]
      )
      if (cfCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO custom_field_values (id, organization_id, tenant_id, entity_id, record_id, field_key, value_text, created_at)
           VALUES ($1, $2, $3, 'catalog:catalog_product', $4, $5, $6, NOW())`,
          [crypto.randomUUID(), orgId, tenantId, prodId, entry.key, entry.val]
        )
      } else {
        await client.query(
          `UPDATE custom_field_values SET value_text = $1 WHERE id = $2`,
          [entry.val, cfCheck.rows[0].id]
        )
      }
    }

    // Upsert product variants
    const definedVariants = (p as any).variants || [
      { sku: p.sku, name: `${p.pack}${p.uom} Standard Pack`, pack: p.pack, uom: p.uom, mrp: p.mrp, rate: p.rate, isDefault: true }
    ]

    // Clear old variants for this product
    await client.query('DELETE FROM catalog_product_variants WHERE product_id = $1', [prodId])

    for (const v of definedVariants) {
      const variantId = crypto.randomUUID()
      const varMeta = {
        pack_size: `${v.pack} ${v.uom}`,
        pack: v.pack,
        uom: v.uom,
        mrp: String(v.mrp),
        rate: String(v.rate),
        shelf_life: '24 Months',
      }
      await client.query(
        `INSERT INTO catalog_product_variants (id, product_id, organization_id, tenant_id, name, sku, is_default, is_active, weight_value, weight_unit, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, NOW(), NOW())`,
        [variantId, prodId, orgId, tenantId, v.name, v.sku, Boolean(v.isDefault), Number(v.pack), v.uom, JSON.stringify(varMeta)]
      )

      // Add to variantListForOrders
      variantListForOrders.push({
        product: p,
        variant: { sku: v.sku, name: v.name, pack: v.pack, uom: v.uom, mrp: v.mrp, rate: v.rate }
      })

      // Upsert custom_field_values for catalog:catalog_product_variant
      const varCfEntries = [
        { key: 'pack_size', val: `${v.pack} ${v.uom}` },
        { key: 'uom', val: v.uom },
        { key: 'shelf_life', val: '24 Months' },
      ]
      for (const entry of varCfEntries) {
        await client.query(
          `INSERT INTO custom_field_values (id, organization_id, tenant_id, entity_id, record_id, field_key, value_text, created_at)
           VALUES ($1, $2, $3, 'catalog:catalog_product_variant', $4, $5, $6, NOW())`,
          [crypto.randomUUID(), orgId, tenantId, variantId, entry.key, entry.val]
        )
      }
    }
  }

  // 5. Clean & Re-generate Connected Sales Orders with accurate Customer Snapshots and Order Metadata
  console.log('\nGenerating connected sales orders across all 10 pipeline stages...')
  await client.query('DELETE FROM sales_order_lines')
  await client.query('DELETE FROM sales_orders')

  const stages = [
    { stage: 'new', label: 'New', count: 3 },
    { stage: 'verified', label: 'Verified / Official', count: 3 },
    { stage: 'rnd_sample', label: 'R&D / Sample', count: 3 },
    { stage: 'artwork', label: 'Artwork / Packaging', count: 3 },
    { stage: 'procurement', label: 'Procurement / Material', count: 2 },
    { stage: 'production', label: 'Production', count: 3 },
    { stage: 'qc', label: 'QC / QA', count: 2 },
    { stage: 'billing', label: 'Billing / Payment', count: 2 },
    { stage: 'ready_dispatch', label: 'Ready to Dispatch', count: 2 },
    { stage: 'dispatched', label: 'Dispatched / Completed', count: 2 },
  ]

  let orderSeq = 101

  for (const s of stages) {
    for (let i = 0; i < s.count; i++) {
      // Pick next variant from variantListForOrders to demonstrate orders for different variants
      const vEntry = variantListForOrders[(orderSeq - 101) % variantListForOrders.length]
      const p1 = vEntry.product
      const v1 = vEntry.variant
      const custName = p1.brand
      const custInfo = customerMap.get(custName)!
      const orderId = crypto.randomUUID()
      const orderNumber = `ORD-2026-${String(orderSeq).padStart(4, '0')}`
      const batchNo = `BATCH-0${String(orderSeq)}`
      orderSeq++
      const prodId = productDbMap.get(p1.sku)!

      const qty = 1000
      const rate = v1.rate
      const gstRate = 18
      const net = qty * rate
      const tax = (net * gstRate) / 100
      const gross = net + tax

      const advancePercent = 40
      const advanceAmount = Math.round((gross * advancePercent) / 100)
      const isAdvancePaid = ['verified', 'rnd_sample', 'artwork', 'procurement', 'production', 'qc', 'billing', 'ready_dispatch', 'dispatched'].includes(s.stage)
      const priority = (orderSeq % 4 === 0) ? 'Urgent' : ((orderSeq % 3 === 0) ? 'High' : 'Normal')
      const orderType = (orderSeq % 2 === 0) ? 'REPEAT' : 'NEW'

      // Master order metadata mapping
      const orderMeta = {
        order_stage: s.stage,
        order_type: orderType,
        packaging_status_tag: orderType,
        priority,
        sales_poc: custInfo.poc,
        packaging_type: 'Bottle',
        primary_packaging: 'Bottle',
        pm_source: (orderSeq % 2 === 0) ? 'dermat' : 'client',
        artwork_requirement: (orderSeq % 3 === 0) ? 'in_house' : 'client',
        advance_required: true,
        advance_percent: advancePercent,
        advance_received_amount: isAdvancePaid ? advanceAmount : 0,
        advance_received_at: isAdvancePaid ? new Date().toISOString().slice(0, 10) : null,
        brand_name: custName,
        company_brand_name: custName,
        product_name: `${p1.title} (${v1.pack}${v1.uom})`,
        variant_name: v1.name,
        pack_code: v1.sku,
        pack_size: v1.pack,
        uom: v1.uom,
        quantity: String(qty),
        batch_no: batchNo,
        mfg_month: '09/2026',
        mrp: String(v1.mrp),
        mrp_per_unit: (v1.mrp / Number(v1.pack)).toFixed(2),
        expiry: '24 Months',
        rd_no: s.stage === 'rnd_sample' ? `RD-2026-0${orderSeq}` : '—',
        artwork_finalized: ['artwork', 'procurement', 'production', 'qc', 'billing', 'ready_dispatch', 'dispatched'].includes(s.stage) ? 'Yes' : 'Pending',
        qa_approval_date: ['qc', 'billing', 'ready_dispatch', 'dispatched'].includes(s.stage) ? '2026-09-18' : '—',
        sent_to_printing: ['procurement', 'production', 'qc', 'billing', 'ready_dispatch', 'dispatched'].includes(s.stage) ? 'Done' : 'Pending',
        carton_stock: 'In Stock',
        tube_label_stock: 'Ready',
        action_taken_status: s.stage === 'production' ? 'IN PRODUCTION' : (s.stage === 'dispatched' ? 'DISPATCHED' : 'ACTIVE'),
        billing_rate: String(rate),
        billing_remarks: isAdvancePaid ? '40% Advance Received' : 'Advance Pending',
        designer_status: 'PM OK',
      }

      // Customer Snapshot JSON
      const customerSnapshot = {
        customer: {
          id: custInfo.entityId,
          displayName: custName,
          primaryEmail: custInfo.email,
          primaryPhone: custInfo.phone,
          gstin: custInfo.gstin,
        },
        contact: {
          firstName: custInfo.poc.split(' ')[0],
          lastName: custInfo.poc.split(' ')[1] || '',
          phone: custInfo.phone,
          email: custInfo.email,
        }
      }

      const billingSnapshot = {
        city: custInfo.city,
        state: custInfo.state,
        countryCode: 'IN',
        addressLine1: custInfo.address,
        postalCode: custInfo.zip,
        taxId: custInfo.gstin,
      }

      await client.query(
        `INSERT INTO sales_orders (
          id, organization_id, tenant_id, order_number, customer_entity_id,
          status, currency_code, tax_strategy_key, placed_at, expected_delivery_at,
          subtotal_net_amount, subtotal_gross_amount, tax_total_amount,
          grand_total_net_amount, grand_total_gross_amount,
          line_item_count, customer_snapshot, billing_address_snapshot, shipping_address_snapshot, metadata,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          'confirmed', 'INR', 'gst_exclusive', NOW(), NOW() + INTERVAL '30 days',
          $6, $7, $8,
          $6, $7,
          1, $9, $10, $10, $11,
          NOW(), NOW()
        )`,
        [
          orderId, orgId, tenantId, orderNumber, custInfo.entityId,
          net.toFixed(4), gross.toFixed(4), tax.toFixed(4),
          JSON.stringify(customerSnapshot), JSON.stringify(billingSnapshot), JSON.stringify(orderMeta)
        ]
      )

      // Line metadata
      const lineMeta = {
        line_kind: 'fg',
        variant_sku: v1.sku,
        variant_name: v1.name,
        brand_name: custName,
        pack_size: v1.pack,
        uom: v1.uom,
        mrp: String(v1.mrp),
        billing_rate: String(rate),
      }

      await client.query(
        `INSERT INTO sales_order_lines (
          id, order_id, organization_id, tenant_id, line_number,
          kind, product_id, name, quantity, currency_code,
          unit_price_net, unit_price_gross, tax_rate, tax_amount,
          total_net_amount, total_gross_amount, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 1,
          'product', $5, $6, $7, 'INR',
          $8, $9, $10, $11,
          $12, $13, $14, NOW(), NOW()
        )`,
        [
          crypto.randomUUID(), orderId, orgId, tenantId,
          prodId, p1.title, qty.toFixed(4),
          rate.toFixed(4), (rate * 1.18).toFixed(4), gstRate.toFixed(4), tax.toFixed(4),
          net.toFixed(4), gross.toFixed(4), JSON.stringify(lineMeta)
        ]
      )

      // Insert custom_field_values for sales:sales_order
      const orderCfValues = [
        { key: 'order_stage', val: s.stage },
        { key: 'company_brand_name', val: custName },
        { key: 'sales_poc', val: custInfo.poc },
        { key: 'gstin', val: custInfo.gstin },
        { key: 'packaging_type', val: 'Bottle' },
        { key: 'brand_name', val: custName },
      ]
      for (const cf of orderCfValues) {
        await client.query(
          `INSERT INTO custom_field_values (id, organization_id, tenant_id, entity_id, record_id, field_key, value_text, created_at)
           VALUES ($1, $2, $3, 'sales:sales_order', $4, $5, $6, NOW())`,
          [crypto.randomUUID(), orgId, tenantId, orderId, cf.key, cf.val]
        )
      }
    }
  }

  console.log('\nMaster Data Seed & Normalization successfully completed!')
  await client.end()
}

main().catch((err) => {
  console.error('Error during seeding:', err)
  process.exit(1)
})
