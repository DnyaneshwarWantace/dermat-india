"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page, PageBody } from "@open-mercato/ui/backend/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@open-mercato/ui/primitives/card";
import { Button } from "@open-mercato/ui/primitives/button";
import { Input } from "@open-mercato/ui/primitives/input";
import { Label } from "@open-mercato/ui/primitives/label";
import { Textarea } from "@open-mercato/ui/primitives/textarea";
import { StepIndicator, type StepIndicatorStep } from "@open-mercato/ui/primitives/step-indicator";
import { StatusBadge } from "@open-mercato/ui/primitives/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-mercato/ui/primitives/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@open-mercato/ui/primitives/dialog";
import { Trash2, Plus, Pencil, Building2, Sparkles } from "lucide-react";
import { apiCall } from "@open-mercato/ui/backend/utils/apiCall";
import { createCrud } from "@open-mercato/ui/backend/utils/crud";
import { flash } from "@open-mercato/ui/backend/FlashMessages";
import { useT } from "@open-mercato/shared/lib/i18n/context";
import { useOrganizationScopeDetail } from "@open-mercato/shared/lib/frontend/useOrganizationScope";

type WizardStepId = "basic" | "variants";

type CustomerOption = {
  id: string;
  displayName: string;
  gstin?: string | null;
  phone?: string | null;
};

const WIZARD_STEPS: { id: WizardStepId; label: string }[] = [
  { id: "basic", label: "Basic Product & Client" },
  { id: "variants", label: "Variants & Pack Sizes" },
];

const UOM_OPTIONS = [
  { value: "ml", label: "ml (Milliliter)" },
  { value: "gm", label: "gm (Gram)" },
  { value: "kg", label: "kg (Kilogram)" },
  { value: "l", label: "L (Liter)" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "Serum", label: "Face Serum" },
  { value: "Cream", label: "Face Cream / Moisturizer" },
  { value: "Lotion", label: "Body Lotion / Milk" },
  { value: "Gel", label: "Treatment Gel / Salicylic" },
  { value: "Face Wash", label: "Cleanser / Face Wash" },
  { value: "Sunscreen", label: "Sunscreen Gel / Lotion SPF" },
  { value: "Toner", label: "Facial Toner / Mist" },
  { value: "Shampoo", label: "Hair Care / Shampoo / Conditioner" },
  { value: "Mask", label: "Face Mask / Peeling Solution" },
  { value: "Oil", label: "Face / Hair Oil" },
  { value: "Other", label: "Other / General Product" },
] as const;

const VARIANT_NAME_OPTIONS = [
  { value: "Standard", label: "Standard" },
  { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" },
  { value: "Large", label: "Large" },
  { value: "Mini", label: "Mini" },
  { value: "Sample", label: "Sample" },
] as const;

type VariantDraft = {
  key: string;
  name: string;
  packSize: string;
  uom: string;
  mrp: string;
  rate?: string;
  gstTaxCategory: string;
  gstPercent: string;
  shelfLife: string;
  isActive: boolean;
};

function makeEmptyVariant(): VariantDraft {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `variant-${Math.random().toString(36).slice(2)}`,
    name: "Standard",
    packSize: "",
    uom: "ml",
    mrp: "",
    rate: "",
    gstTaxCategory: "18% GST Cosmetics",
    gstPercent: "18",
    shelfLife: "24 Months",
    isActive: true,
  };
}

export default function CreateCatalogProductPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { organizationId, tenantId } = useOrganizationScopeDetail();

  const [activeStep, setActiveStep] = React.useState<WizardStepId>("basic");
  
  // Make-to-Order / Customer Assignment state
  const [customers, setCustomers] = React.useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>("__none__");
  const [clientBrandName, setClientBrandName] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [productCode, setProductCode] = React.useState("");
  const [category, setCategory] = React.useState("Serum");
  const [minFloorQty, setMinFloorQty] = React.useState("");
  const [stockQty, setStockQty] = React.useState("0");
  const [baseUom, setBaseUom] = React.useState("ml");
  const [description, setDescription] = React.useState("");
  const [variants, setVariants] = React.useState<VariantDraft[]>([]);
  const [variantDialogOpen, setVariantDialogOpen] = React.useState(false);
  const [editingVariantKey, setEditingVariantKey] = React.useState<string | null>(null);
  const [variantDraft, setVariantDraft] = React.useState<VariantDraft>(makeEmptyVariant());
  const [submitting, setSubmitting] = React.useState(false);

  // Load existing customers from DB
  React.useEffect(() => {
    async function loadCustomers() {
      setLoadingCustomers(true);
      try {
        const call = await apiCall<{ items: Array<{ id: string; display_name?: string; primary_phone?: string | null; cf_gst_number?: string | null }> }>(
          "/api/customers/companies?pageSize=100"
        );
        if (call.ok && call.result?.items) {
          setCustomers(
            call.result.items.map((c) => ({
              id: c.id,
              displayName: c.display_name || "Unnamed Company",
              gstin: c.cf_gst_number || null,
              phone: c.primary_phone || null,
            }))
          );
        }
      } catch (err) {
        // Soft fallback
      } finally {
        setLoadingCustomers(false);
      }
    }
    loadCustomers();
  }, []);

  const titleValid = title.trim().length > 0;

  const steps: StepIndicatorStep[] = React.useMemo(
    () =>
      WIZARD_STEPS.map((step) => ({
        id: step.id,
        label: t(`catalog.products.wizard.step.${step.id}`, step.label),
        status: step.id === activeStep ? "current" : step.id === "basic" && titleValid ? "complete" : "pending",
      })),
    [activeStep, titleValid, t],
  );

  const openNewVariantDialog = React.useCallback(() => {
    setEditingVariantKey(null);
    setVariantDraft(makeEmptyVariant());
    setVariantDialogOpen(true);
  }, []);

  const openEditVariantDialog = React.useCallback((variant: VariantDraft) => {
    setEditingVariantKey(variant.key);
    setVariantDraft(variant);
    setVariantDialogOpen(true);
  }, []);

  const saveVariantDraft = React.useCallback(() => {
    const finalName = variantDraft.name.trim() || (variantDraft.packSize.trim() ? `${variantDraft.packSize.trim()} ${variantDraft.uom.trim() || ""}`.trim() : "Standard");
    const updatedDraft = { ...variantDraft, name: finalName };
    setVariants((prev) => {
      if (editingVariantKey) {
        return prev.map((item) => (item.key === editingVariantKey ? updatedDraft : item));
      }
      return [...prev, updatedDraft];
    });
    setVariantDialogOpen(false);
  }, [variantDraft, editingVariantKey]);

  const removeVariant = React.useCallback((key: string) => {
    setVariants((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const goToVariants = React.useCallback(() => {
    if (!titleValid) {
      flash(t("catalog.products.wizard.errors.titleRequired", "Enter a product name to continue"), "error");
      return;
    }
    setActiveStep("variants");
  }, [titleValid, t]);

  const handleSubmit = React.useCallback(async () => {
    if (!titleValid) {
      flash(t("catalog.products.wizard.errors.titleRequired", "Enter a product name to continue"), "error");
      setActiveStep("basic");
      return;
    }
    setSubmitting(true);
    try {
      const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);
      const isMakeToOrder = selectedCustomerId !== "__none__";

      const customFields: Record<string, unknown> = {};
      if (productCode.trim()) customFields.product_code = productCode.trim();
      if (category.trim()) customFields.category = category.trim();
      if (baseUom.trim()) customFields.base_uom = baseUom.trim();
      if (isMakeToOrder && selectedCustomerObj) {
        customFields.customer_id = selectedCustomerObj.id;
        customFields.customer_name = selectedCustomerObj.displayName;
        customFields.client_brand = clientBrandName.trim() || selectedCustomerObj.displayName;
        customFields.is_make_to_order = true;
      }
      const minFloorQtyNum = Number(minFloorQty);
      if (minFloorQty.trim() && !Number.isNaN(minFloorQtyNum)) customFields.min_floor_qty = minFloorQtyNum;
      const stockQtyNum = Number(stockQty);
      if (stockQty.trim() && !Number.isNaN(stockQtyNum)) customFields.stock_qty = stockQtyNum;

      const payload: Record<string, unknown> = {
        organizationId,
        tenantId,
        title: title.trim(),
        description: description.trim() || undefined,
        metadata: {
          is_make_to_order: isMakeToOrder,
          customer_id: isMakeToOrder && selectedCustomerObj ? selectedCustomerObj.id : undefined,
          customer_name: isMakeToOrder && selectedCustomerObj ? selectedCustomerObj.displayName : undefined,
          client_brand: clientBrandName.trim() || undefined,
          stock_qty: !Number.isNaN(stockQtyNum) ? stockQtyNum : 0,
        },
      };
      if (Object.keys(customFields).length) payload.customFields = customFields;

      const created = await createCrud<{ id?: string }>("catalog/products", payload);
      const productId = created.result?.id;

      if (!productId) {
        flash(t("catalog.products.wizard.errors.createFailed", "Product created, but its ID was not returned."), "error");
      } else {
        for (const variant of variants) {
          const packSizeVal = variant.packSize.trim();
          const uomVal = variant.uom.trim();
          const shelfLifeVal = variant.shelfLife.trim();
          const mrpVal = variant.mrp.trim();
          const mrpNum = Number(mrpVal);
          const gstTaxVal = variant.gstTaxCategory.trim() || "18% GST Cosmetics";
          const gstPercentVal = variant.gstPercent.trim() || "18";
          const gstPercentNum = Number(gstPercentVal);

          const variantCustomFields: Record<string, unknown> = {};
          if (packSizeVal) variantCustomFields.pack_size = packSizeVal;
          if (uomVal) variantCustomFields.uom = uomVal;
          if (shelfLifeVal) variantCustomFields.shelf_life = shelfLifeVal;
          if (mrpVal && !Number.isNaN(mrpNum)) variantCustomFields.mrp = mrpNum;
          if (variant.rate?.trim() && !Number.isNaN(Number(variant.rate))) variantCustomFields.rate = Number(variant.rate.trim());
          if (gstTaxVal) variantCustomFields.gst_tax_category = gstTaxVal;
          if (gstPercentVal && !Number.isNaN(gstPercentNum)) variantCustomFields.gst_percent = gstPercentNum;

          const metadata: Record<string, unknown> = {
            pack_size: packSizeVal,
            uom: uomVal,
            shelf_life: shelfLifeVal,
            mrp: mrpVal,
            rate: variant.rate?.trim() || undefined,
            gst_tax_category: gstTaxVal,
            gst_percent: gstPercentVal,
          };

          const variantPayload: Record<string, unknown> = {
            organizationId,
            tenantId,
            productId,
            name: variant.name.trim() || "Standard",
            isActive: variant.isActive,
            metadata,
          };

          const packSizeNum = Number(packSizeVal);
          if (packSizeVal && !Number.isNaN(packSizeNum)) {
            variantPayload.weightValue = packSizeNum;
          }
          if (uomVal) {
            variantPayload.weightUnit = uomVal;
          }

          if (Object.keys(variantCustomFields).length) {
            variantPayload.customFields = variantCustomFields;
          }

          try {
            await createCrud("catalog/variants", variantPayload);
          } catch (err) {
            const message = err instanceof Error ? err.message : t("catalog.products.wizard.errors.variantFailed", "Failed to save a variant");
            flash(message, "error");
          }
        }
      }

      flash(t("catalog.products.create.success", "Product created successfully."), "success");
      if (returnTo) {
        router.push(returnTo);
      } else {
        router.push(productId ? `/backend/catalog/products/${productId}` : "/backend/catalog/products");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("catalog.products.wizard.errors.createFailed", "Failed to create product");
      flash(message, "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    titleValid,
    title,
    description,
    productCode,
    category,
    baseUom,
    minFloorQty,
    stockQty,
    selectedCustomerId,
    clientBrandName,
    customers,
    variants,
    organizationId,
    tenantId,
    returnTo,
    router,
    t,
  ]);

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{t("catalog.products.create.title", "Create New Product")}</h1>
            <Button type="button" variant="outline" asChild>
              <a href={returnTo ?? "/backend/catalog/products"}>{t("ui.detail.inline.cancel", "Cancel")}</a>
            </Button>
          </div>

          <StepIndicator steps={steps} onStepClick={(id) => setActiveStep(id as WizardStepId)} />

          {activeStep === "basic" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{t("catalog.products.wizard.step.basic", "Basic Product & Client Assignment")}</span>
                  <span className="text-xs font-normal text-muted-foreground">Make-to-Order Contract Manufacturing</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Make-to-Order Customer Attachment */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">Customer / Private Label Client Assignment</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Attach Customer / Company</Label>
                      <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Select Customer..."} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-xs">
                            Standard In-House Master (No specific client)
                          </SelectItem>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.displayName} {c.gstin ? `(GST: ${c.gstin})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Client Brand Name</Label>
                      <Input
                        value={clientBrandName}
                        onChange={(e) => setClientBrandName(e.target.value)}
                        placeholder="e.g. SkinGlo, DermaCare, Dr. Botanicals"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>{t("catalog.products.form.title", "Product Name")} *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10% Niacinamide Face Serum with Zinc PCA" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{t("catalog.products.form.productCode", "Product Code / SKU")}</Label>
                    <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="e.g. DER-FORM-089" />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("catalog.products.form.category", "Category")}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("catalog.products.form.category.placeholder", "Select category…")} />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("catalog.products.form.stockQty", "Initial Stock Quantity (Units)")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-[11px] text-muted-foreground">Default 0 for Make-to-Order (MTO). Automatically increased when production finishes.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("catalog.products.form.minFloorQty", "Minimum Floor Quantity (MOQ)")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={minFloorQty}
                      onChange={(e) => setMinFloorQty(e.target.value)}
                      placeholder="e.g. 500"
                    />
                    <p className="text-[11px] text-muted-foreground">Minimum batch units required per production run.</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>{t("catalog.products.form.baseUom", "Base UOM")}</Label>
                    <Select value={baseUom} onValueChange={setBaseUom}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("catalog.products.form.baseUom.placeholder", "Select unit…")} />
                      </SelectTrigger>
                      <SelectContent>
                        {UOM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t("catalog.products.form.description", "Description")}</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeStep === "variants" ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t("catalog.products.wizard.step.variants", "Variants")}</CardTitle>
                <Button type="button" size="sm" onClick={openNewVariantDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("catalog.products.wizard.addVariant", "Add Variant")}
                </Button>
              </CardHeader>
              <CardContent>
                {variants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("catalog.products.wizard.noVariants", "No variants yet. Add a pack size to get started.")}
                  </p>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                          <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.name", "Variant Name")}</th>
                          <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.packSize", "Pack Size")}</th>
                          <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.uom", "UOM")}</th>
                          <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.mrp", "MRP")}</th>
                          <th className="py-2 pr-2">GST Rate</th>
                          <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.status", "Status")}</th>
                          <th className="w-20 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((variant) => (
                          <tr key={variant.key} className="border-b border-border/60">
                            <td className="py-2 pr-2 font-medium">{variant.name}</td>
                            <td className="py-2 pr-2">{variant.packSize || "—"}</td>
                            <td className="py-2 pr-2">{variant.uom || "—"}</td>
                            <td className="py-2 pr-2 font-semibold text-emerald-600 dark:text-emerald-400">{variant.mrp ? `₹${variant.mrp}` : "—"}</td>
                            <td className="py-2 pr-2 font-mono text-xs text-slate-700">{variant.gstPercent ? `${variant.gstPercent}%` : "18%"}</td>
                            <td className="py-2 pr-2">
                              <StatusBadge variant={variant.isActive ? "success" : "neutral"}>
                                {variant.isActive
                                  ? t("catalog.products.wizard.variant.active", "Active")
                                  : t("catalog.products.wizard.variant.inactive", "Inactive")}
                              </StatusBadge>
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditVariantDialog(variant)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => removeVariant(variant.key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <div className="flex items-center justify-between">
            {activeStep === "variants" ? (
              <Button type="button" variant="outline" onClick={() => setActiveStep("basic")}>
                {t("dermat_sales_flow.orderBook.wizard.back", "Back")}
              </Button>
            ) : (
              <span />
            )}
            {activeStep === "basic" ? (
              <Button type="button" onClick={goToVariants} disabled={!titleValid}>
                {t("dermat_sales_flow.orderBook.wizard.continue", "Continue")}
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {t("catalog.products.form.submit", "Create Product")}
              </Button>
            )}
          </div>
        </div>

        <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingVariantKey
                  ? t("catalog.products.wizard.editVariant", "Edit Variant")
                  : t("catalog.products.wizard.addVariant", "Add Variant")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("catalog.products.wizard.variantTable.name", "Variant Name")}</Label>
                <Select
                  value={variantDraft.name}
                  onValueChange={(val) => setVariantDraft((prev) => ({ ...prev, name: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select variant (Standard, Small, Large…)" />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT_NAME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>{t("catalog.products.wizard.variantTable.packSize", "Pack Size")}</Label>
                  <Input
                    value={variantDraft.packSize}
                    onChange={(e) => setVariantDraft((prev) => ({ ...prev, packSize: e.target.value }))}
                    placeholder="50"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("catalog.products.wizard.variantTable.uom", "UOM")}</Label>
                  <Select value={variantDraft.uom} onValueChange={(val) => setVariantDraft((prev) => ({ ...prev, uom: val }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("catalog.products.wizard.variant.uomPlaceholder", "Select unit…")} />
                    </SelectTrigger>
                    <SelectContent>
                      {UOM_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>{t("catalog.products.wizard.variantTable.mrp", "Declared MRP (₹)")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={variantDraft.mrp}
                    onChange={(e) => setVariantDraft((prev) => ({ ...prev, mrp: e.target.value }))}
                    placeholder="599"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Wholesale Rate (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={variantDraft.rate || ""}
                    onChange={(e) => setVariantDraft((prev) => ({ ...prev, rate: e.target.value }))}
                    placeholder="180"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>GST Rate (%)</Label>
                  <Input
                    value={variantDraft.gstPercent}
                    onChange={(e) => setVariantDraft((prev) => ({ ...prev, gstPercent: e.target.value }))}
                    placeholder="18"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tax Category</Label>
                  <Input
                    value={variantDraft.gstTaxCategory}
                    onChange={(e) => setVariantDraft((prev) => ({ ...prev, gstTaxCategory: e.target.value }))}
                    placeholder="18% GST Cosmetics"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("catalog.products.wizard.variantTable.shelfLife", "Shelf Life")}</Label>
                <Input
                  value={variantDraft.shelfLife}
                  onChange={(e) => setVariantDraft((prev) => ({ ...prev, shelfLife: e.target.value }))}
                  placeholder="24 Months"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVariantDialogOpen(false)}>
                {t("ui.detail.inline.cancel", "Cancel")}
              </Button>
              <Button type="button" onClick={saveVariantDraft}>
                {t("catalog.products.wizard.saveVariant", "Save Variant")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </Page>
  );
}
