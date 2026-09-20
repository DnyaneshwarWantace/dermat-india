import { asValue } from 'awilix'
import type { AppContainer } from '@wantace/shared/lib/di/container'
import {
  Supplier,
  SupplierPricing,
  PurchaseOrder,
  PurchaseOrderLine,
  GoodsReceipt,
  GoodsReceiptLine,
  PurchaseInvoice,
  PurchaseInvoiceLine,
} from './data/entities'

export function register(container: AppContainer) {
  container.register({
    Supplier: asValue(Supplier),
    SupplierPricing: asValue(SupplierPricing),
    PurchaseOrder: asValue(PurchaseOrder),
    PurchaseOrderLine: asValue(PurchaseOrderLine),
    GoodsReceipt: asValue(GoodsReceipt),
    GoodsReceiptLine: asValue(GoodsReceiptLine),
    PurchaseInvoice: asValue(PurchaseInvoice),
    PurchaseInvoiceLine: asValue(PurchaseInvoiceLine),
  })
}
