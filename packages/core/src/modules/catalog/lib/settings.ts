export const CATALOG_SETTINGS_MODULE_ID = 'catalog'

// Controls whether the EU unit-price presentation feature is exposed at all.
// Default ON so existing tenants keep the current behavior; manufacturers or
// other non-retail tenants can turn it off to remove the settings from the
// product form entirely.
export const UNIT_PRICE_DISPLAY_ENABLED_KEY = 'unit_price_display_enabled'
export const UNIT_PRICE_DISPLAY_ENABLED_DEFAULT = true

// Prefix used to auto-generate a product's SKU/code when none is typed on create
// (e.g. "PROD-" -> PROD-00001, PROD-00002, ...). Configurable per tenant so a client
// can rename it at any time; only products created *after* the change pick up the new
// prefix — existing SKUs are never renumbered or rewritten.
export const AUTO_SKU_PREFIX_KEY = 'auto_sku_prefix'
export const AUTO_SKU_PREFIX_DEFAULT = 'PROD-'
