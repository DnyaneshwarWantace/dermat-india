"use client";

import * as React from "react";
import { Page, PageBody } from "@open-mercato/ui/backend/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@open-mercato/ui/primitives/card";
import { Button } from "@open-mercato/ui/primitives/button";
import { Input } from "@open-mercato/ui/primitives/input";
import { Label } from "@open-mercato/ui/primitives/label";
import { Textarea } from "@open-mercato/ui/primitives/textarea";
import { StatusBadge } from "@open-mercato/ui/primitives/status-badge";
import { Checkbox } from "@open-mercato/ui/primitives/checkbox";
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
import {
  Trash2,
  Plus,
  Pencil,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Table as TableIcon,
  Layers,
  Package,
  Boxes,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { apiCall } from "@open-mercato/ui/backend/utils/apiCall";
import { updateCrud, createCrud, deleteCrud } from "@open-mercato/ui/backend/utils/crud";
import { buildOptimisticLockHeader } from "@open-mercato/ui/backend/utils/optimisticLock";
import { withScopedApiRequestHeaders } from "@open-mercato/ui/backend/utils/apiCall";
import { surfaceRecordConflict } from "@open-mercato/ui/backend/conflicts";
import { flash } from "@open-mercato/ui/backend/FlashMessages";
import { LoadingMessage, ErrorMessage, RecordNotFoundState } from "@open-mercato/ui/backend/detail";
import { useT } from "@open-mercato/shared/lib/i18n/context";
import { useOrganizationScopeDetail } from "@open-mercato/shared/lib/frontend/useOrganizationScope";

const UOM_OPTIONS = [
  { value: "ml", label: "ml (Milliliter)" },
  { value: "gm", label: "gm (Gram)" },
  { value: "kg", label: "kg (Kilogram)" },
  { value: "l", label: "L (Liter)" },
] as const;

const VARIANT_NAME_OPTIONS = [
  { value: "Standard", label: "Standard" },
  { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" },
  { value: "Large", label: "Large" },
  { value: "Mini", label: "Mini" },
  { value: "Sample", label: "Sample" },
] as const;

type ProductData = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
  cf_product_code: string | null;
  cf_internal_id: string | null;
  cf_min_floor_qty: number | null;
  cf_category: string | null;
  cf_gst_tax_category: string | null;
  cf_base_uom: string | null;
};

type VariantRow = {
  id: string;
  name: string | null;
  is_active: boolean;
  updated_at: string;
  cf_pack_size?: string | null;
  cf_uom?: string | null;
  cf_mrp?: string | number | null;
  cf_shelf_life?: string | null;
  metadata?: Record<string, unknown> | null;
  weight_value?: string | number | null;
  weight_unit?: string | null;
};

type VariantDraft = {
  name: string;
  packSize: string;
  uom: string;
  mrp: string;
  shelfLife: string;
  isActive: boolean;
};

function emptyVariantDraft(): VariantDraft {
  return { name: "Standard", packSize: "", uom: "ml", mrp: "", shelfLife: "", isActive: true };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function ProductDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT();
  const id = params?.id;
  const { organizationId, tenantId } = useOrganizationScopeDetail();

  const [product, setProduct] = React.useState<ProductData | null>(null);
  const [variants, setVariants] = React.useState<VariantRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isNotFound, setIsNotFound] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [productCode, setProductCode] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [gstTaxCategory, setGstTaxCategory] = React.useState("");
  const [minFloorQty, setMinFloorQty] = React.useState("");
  const [baseUom, setBaseUom] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [variantDialogOpen, setVariantDialogOpen] = React.useState(false);
  const [editingVariantId, setEditingVariantId] = React.useState<string | null>(null);
  const [variantDraft, setVariantDraft] = React.useState<VariantDraft>(emptyVariantDraft());

  // Tree UI state: view mode ('tree' | 'table') and collapsed variant keys
  const [viewMode, setViewMode] = React.useState<"tree" | "table">("tree");
  const [treeExpanded, setTreeExpanded] = React.useState(true);
  const [expandedVariantIds, setExpandedVariantIds] = React.useState<Record<string, boolean>>({});

  const toggleVariantExpand = React.useCallback((variantId: string) => {
    setExpandedVariantIds((prev) => ({
      ...prev,
      [variantId]: !prev[variantId],
    }));
  }, []);

  const expandAllVariants = React.useCallback(() => {
    const next: Record<string, boolean> = {};
    variants.forEach((v) => {
      next[v.id] = true;
    });
    setExpandedVariantIds(next);
    setTreeExpanded(true);
  }, [variants]);

  const collapseAllVariants = React.useCallback(() => {
    setExpandedVariantIds({});
  }, []);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const productCall = await apiCall<{ items: ProductData[] }>(`/api/catalog/products?id=${id}`);
        const found = productCall.ok ? productCall.result?.items?.[0] : null;
        if (!found) {
          if (!cancelled) setIsNotFound(true);
          return;
        }
        const variantsCall = await apiCall<{ items: VariantRow[] }>(
          `/api/catalog/variants?productId=${id}&pageSize=100`,
        );
        if (!cancelled) {
          setProduct(found);
          setTitle(found.title ?? "");
          setProductCode(found.cf_product_code ?? "");
          setCategory(found.cf_category ?? "");
          setGstTaxCategory(found.cf_gst_tax_category ?? "");
          setMinFloorQty(found.cf_min_floor_qty != null ? String(found.cf_min_floor_qty) : "");
          setBaseUom(found.cf_base_uom ?? "");
          setDescription(found.description ?? "");

          const rawVariants = variantsCall.ok ? variantsCall.result?.items ?? [] : [];
          const normalizedVariants: VariantRow[] = rawVariants.map((v) => {
            const meta = (v.metadata && typeof v.metadata === "object" ? v.metadata : {}) as Record<string, any>;
            return {
              ...v,
              cf_pack_size: v.cf_pack_size ?? (meta.pack_size ? String(meta.pack_size) : null) ?? (v.weight_value != null ? String(v.weight_value) : null),
              cf_uom: v.cf_uom ?? (meta.uom ? String(meta.uom) : null) ?? v.weight_unit ?? null,
              cf_mrp: v.cf_mrp ?? (meta.mrp != null ? meta.mrp : null),
              cf_shelf_life: v.cf_shelf_life ?? (meta.shelf_life ? String(meta.shelf_life) : null),
            };
          });
          setVariants(normalizedVariants);

          // Default expand all variant nodes in tree
          const defaultExpanded: Record<string, boolean> = {};
          normalizedVariants.forEach((v) => {
            defaultExpanded[v.id] = true;
          });
          setExpandedVariantIds(defaultExpanded);
        }
      } catch {
        if (!cancelled) setError(t("catalog.products.detail.errors.load", "Failed to load product"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadToken, t]);

  const handleSave = React.useCallback(async () => {
    if (!product) return;
    if (!title.trim()) {
      flash(t("catalog.products.wizard.errors.titleRequired", "Enter a product name to continue"), "error");
      return;
    }
    setSaving(true);
    try {
      const customFields: Record<string, unknown> = {
        product_code: productCode.trim() || null,
        category: category.trim() || null,
        gst_tax_category: gstTaxCategory.trim() || null,
        base_uom: baseUom.trim() || null,
      };
      const minFloorQtyNum = Number(minFloorQty);
      customFields.min_floor_qty = minFloorQty.trim() && !Number.isNaN(minFloorQtyNum) ? minFloorQtyNum : null;

      await withScopedApiRequestHeaders(
        buildOptimisticLockHeader(product.updatedAt),
        () =>
          updateCrud("catalog/products", {
            id: product.id,
            title: title.trim(),
            description: description.trim() || null,
            customFields,
          }),
      );
      flash(t("catalog.products.detail.saved", "Product updated"), "success");
      setReloadToken((v) => v + 1);
    } catch (err) {
      if (surfaceRecordConflict(err, t, { onRefresh: () => setReloadToken((v) => v + 1) })) return;
      const message = err instanceof Error ? err.message : t("catalog.products.detail.errors.save", "Failed to update product");
      flash(message, "error");
    } finally {
      setSaving(false);
    }
  }, [product, title, productCode, category, gstTaxCategory, minFloorQty, baseUom, description, t]);

  const handleToggleActive = React.useCallback(
    async (nextActive: boolean) => {
      if (!product) return;
      try {
        await withScopedApiRequestHeaders(
          buildOptimisticLockHeader(product.updatedAt),
          () => updateCrud("catalog/products", { id: product.id, isActive: nextActive }),
        );
        setReloadToken((v) => v + 1);
      } catch (err) {
        if (surfaceRecordConflict(err, t, { onRefresh: () => setReloadToken((v) => v + 1) })) return;
        flash(t("catalog.products.detail.errors.save", "Failed to update product"), "error");
      }
    },
    [product, t],
  );

  const openNewVariantDialog = React.useCallback(() => {
    setEditingVariantId(null);
    setVariantDraft(emptyVariantDraft());
    setVariantDialogOpen(true);
  }, []);

  const openEditVariantDialog = React.useCallback((variant: VariantRow) => {
    setEditingVariantId(variant.id);
    setVariantDraft({
      name: variant.name ?? "Standard",
      packSize: variant.cf_pack_size ?? "",
      uom: variant.cf_uom ?? "ml",
      mrp: variant.cf_mrp != null ? String(variant.cf_mrp) : "",
      shelfLife: variant.cf_shelf_life ?? "",
      isActive: variant.is_active,
    });
    setVariantDialogOpen(true);
  }, []);

  const saveVariantDraft = React.useCallback(async () => {
    if (!product || !variantDraft.name.trim()) {
      flash(t("catalog.products.wizard.variant.errors.nameRequired", "Variant name is required"), "error");
      return;
    }
    const packSizeVal = variantDraft.packSize.trim();
    const uomVal = variantDraft.uom.trim();
    const shelfLifeVal = variantDraft.shelfLife.trim();
    const mrpVal = variantDraft.mrp.trim();
    const mrpNum = Number(mrpVal);

    const customFields: Record<string, unknown> = {
      pack_size: packSizeVal || null,
      uom: uomVal || null,
      shelf_life: shelfLifeVal || null,
      mrp: mrpVal && !Number.isNaN(mrpNum) ? mrpNum : null,
    };

    const metadata: Record<string, unknown> = {
      pack_size: packSizeVal,
      uom: uomVal,
      shelf_life: shelfLifeVal,
      mrp: mrpVal,
    };

    try {
      if (editingVariantId) {
        const existing = variants.find((v) => v.id === editingVariantId);
        await withScopedApiRequestHeaders(
          buildOptimisticLockHeader(existing?.updated_at),
          () =>
            updateCrud("catalog/variants", {
              id: editingVariantId,
              name: variantDraft.name.trim() || "Standard",
              isActive: variantDraft.isActive,
              metadata,
              weightValue: packSizeVal && !Number.isNaN(Number(packSizeVal)) ? Number(packSizeVal) : undefined,
              weightUnit: uomVal || undefined,
              customFields,
            }),
        );
      } else {
        await createCrud("catalog/variants", {
          organizationId,
          tenantId,
          productId: product.id,
          name: variantDraft.name.trim() || "Standard",
          isActive: variantDraft.isActive,
          metadata,
          weightValue: packSizeVal && !Number.isNaN(Number(packSizeVal)) ? Number(packSizeVal) : undefined,
          weightUnit: uomVal || undefined,
          customFields,
        });
      }
      flash(t("catalog.products.wizard.saveVariant", "Save Variant"), "success");
      setVariantDialogOpen(false);
      setReloadToken((v) => v + 1);
    } catch (err) {
      if (surfaceRecordConflict(err, t, { onRefresh: () => setReloadToken((v) => v + 1) })) return;
      const message = err instanceof Error ? err.message : t("catalog.products.wizard.errors.variantFailed", "Failed to save a variant");
      flash(message, "error");
    }
  }, [product, variantDraft, editingVariantId, variants, organizationId, tenantId, t]);

  const handleDeleteVariant = React.useCallback(
    async (variant: VariantRow) => {
      try {
        await deleteCrud("catalog/variants", { body: { id: variant.id } });
        flash(t("catalog.products.detail.variantDeleted", "Variant removed"), "success");
        setReloadToken((v) => v + 1);
      } catch {
        flash(t("catalog.products.detail.errors.variantDelete", "Failed to remove variant"), "error");
      }
    },
    [t],
  );

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t("catalog.products.detail.loading", "Loading...")} />
        </PageBody>
      </Page>
    );
  }

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t("catalog.products.detail.errors.notFound", "Product not found.")}
            backHref="/backend/catalog/products"
            backLabel={t("catalog.products.detail.backToList", "Back to Products")}
          />
        </PageBody>
      </Page>
    );
  }

  if (error || !product) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t("catalog.products.detail.errors.notFound", "Product not found.")} />
        </PageBody>
      </Page>
    );
  }

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold">{product.title}</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("catalog.products.detail.updated", "Updated")} {formatDate(product.updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant={product.isActive ? "success" : "neutral"}>
                {product.isActive
                  ? t("catalog.products.wizard.variant.active", "Active")
                  : t("catalog.products.wizard.variant.inactive", "Inactive")}
              </StatusBadge>
              <Button type="button" variant="outline" size="sm" onClick={() => handleToggleActive(!product.isActive)}>
                {product.isActive
                  ? t("catalog.products.detail.deactivate", "Deactivate")
                  : t("catalog.products.detail.activate", "Activate")}
              </Button>
              <Button asChild variant="outline">
                <a href="/backend/catalog/products">{t("catalog.products.detail.backToList", "Back to Products")}</a>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("catalog.products.wizard.step.basic", "Basic Product")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>{t("catalog.products.form.title", "Product Name")} *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t("catalog.products.form.productCode", "Product Code")}</Label>
                  <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("catalog.products.form.internalId", "Internal ID")}</Label>
                  <Input value={product.cf_internal_id ?? "Auto"} disabled />
                </div>
                <div className="space-y-1">
                  <Label>{t("catalog.products.form.category", "Category")}</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("catalog.products.form.gstTaxCategory", "GST / Tax Category")}</Label>
                  <Input value={gstTaxCategory} onChange={(e) => setGstTaxCategory(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("catalog.products.form.minFloorQty", "Minimum Floor Quantity")}</Label>
                  <Input type="number" min={0} value={minFloorQty} onChange={(e) => setMinFloorQty(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("catalog.products.form.baseUom", "Base UOM")}</Label>
                  <Select value={baseUom} onValueChange={setBaseUom}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select UOM (e.g. ml, KG)" />
                    </SelectTrigger>
                    <SelectContent>
                      {UOM_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("catalog.products.form.description", "Description")}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {t("catalog.products.detail.save", "Save changes")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Variants Card with Tree View & Table View */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <Boxes className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("catalog.products.wizard.step.variants", "Variants")} ({variants.length})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Hierarchical tree structure of pack sizes, pricing, and specs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
                  <Button
                    type="button"
                    variant={viewMode === "tree" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setViewMode("tree")}
                  >
                    <FolderTree className="mr-1.5 h-3.5 w-3.5" />
                    Tree View
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === "table" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setViewMode("table")}
                  >
                    <TableIcon className="mr-1.5 h-3.5 w-3.5" />
                    Table View
                  </Button>
                </div>

                {viewMode === "tree" && variants.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={expandAllVariants}
                    >
                      Expand All
                    </Button>
                    <span className="text-muted-foreground/40">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={collapseAllVariants}
                    >
                      Collapse All
                    </Button>
                  </div>
                ) : null}

                <Button type="button" size="sm" onClick={openNewVariantDialog}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t("catalog.products.wizard.addVariant", "Add Variant")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {variants.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Boxes className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                  <p className="font-medium text-foreground">No variants added yet</p>
                  <p className="mt-1 text-xs">Add pack sizes, UOMs, and MRPs for this product.</p>
                  <Button type="button" size="sm" className="mt-4" onClick={openNewVariantDialog}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add First Variant
                  </Button>
                </div>
              ) : viewMode === "tree" ? (
                /* TREE UI VIEW */
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  {/* Root Product Node */}
                  <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setTreeExpanded(!treeExpanded)}
                      className="flex items-center gap-2 text-left font-medium text-foreground hover:text-primary"
                    >
                      {treeExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                      )}
                      <Package className="h-4 w-4 text-primary" />
                      <span>{product.title}</span>
                      {productCode ? (
                        <span className="rounded bg-background px-1.5 py-0.5 text-xs font-mono text-muted-foreground border">
                          {productCode}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {variants.length} {variants.length === 1 ? "variant" : "variants"}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Base UOM: <strong className="text-foreground">{baseUom || "—"}</strong></span>
                      {category ? <span>• Category: <strong className="text-foreground">{category}</strong></span> : null}
                    </div>
                  </div>

                  {/* Child Variant Tree Branches */}
                  {treeExpanded ? (
                    <div className="relative mt-2 pl-4">
                      {/* Vertical Tree Connector Line */}
                      <div className="absolute bottom-4 left-7 top-0 w-px bg-border" />

                      <div className="space-y-2">
                        {variants.map((variant, idx) => {
                          const isLast = idx === variants.length - 1;
                          const isExpanded = !!expandedVariantIds[variant.id];
                          const displayName = variant.name || "Standard";
                          const displayPack = variant.cf_pack_size
                            ? `${variant.cf_pack_size} ${variant.cf_uom || ""}`.trim()
                            : "—";

                          return (
                            <div key={variant.id} className="relative pl-7">
                              {/* Horizontal Branch Connector */}
                              <div className="absolute left-3 top-4 h-px w-4 bg-border" />

                              <div
                                className={`rounded-lg border transition-all ${
                                  isExpanded ? "bg-card shadow-sm border-primary/30" : "bg-muted/20 hover:bg-muted/40"
                                }`}
                              >
                                {/* Variant Node Header */}
                                <div className="flex items-center justify-between px-3 py-2.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleVariantExpand(variant.id)}
                                    className="flex flex-1 items-center gap-2 text-left font-medium text-sm"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-primary" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-foreground">{displayName}</span>
                                    <span className="rounded bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                                      {displayPack}
                                    </span>
                                    {variant.cf_mrp != null ? (
                                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        MRP: ₹{variant.cf_mrp}
                                      </span>
                                    ) : null}
                                    <StatusBadge variant={variant.is_active ? "success" : "neutral"}>
                                      {variant.is_active
                                        ? t("catalog.products.wizard.variant.active", "Active")
                                        : t("catalog.products.wizard.variant.inactive", "Inactive")}
                                    </StatusBadge>
                                  </button>

                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => openEditVariantDialog(variant)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteVariant(variant)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Expanded Variant Details Pane */}
                                {isExpanded ? (
                                  <div className="border-t bg-muted/10 px-4 py-3 text-xs">
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                      <div className="rounded border bg-background p-2">
                                        <div className="text-muted-foreground">Pack Size</div>
                                        <div className="mt-0.5 font-semibold text-sm">
                                          {variant.cf_pack_size || "—"}
                                        </div>
                                      </div>
                                      <div className="rounded border bg-background p-2">
                                        <div className="text-muted-foreground">Unit of Measurement</div>
                                        <div className="mt-0.5 font-semibold text-sm">
                                          {variant.cf_uom || "—"}
                                        </div>
                                      </div>
                                      <div className="rounded border bg-background p-2">
                                        <div className="text-muted-foreground">Maximum Retail Price</div>
                                        <div className="mt-0.5 font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                                          {variant.cf_mrp != null ? `₹${variant.cf_mrp}` : "—"}
                                        </div>
                                      </div>
                                      <div className="rounded border bg-background p-2">
                                        <div className="text-muted-foreground">Shelf Life</div>
                                        <div className="mt-0.5 font-semibold text-sm">
                                          {variant.cf_shelf_life || "—"}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                                      <span>ID: <code className="font-mono">{variant.id}</code></span>
                                      <span>Updated: {formatDate(variant.updated_at)}</span>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                /* TABLE UI VIEW */
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.name", "Variant Name")}</th>
                        <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.packSize", "Pack Size")}</th>
                        <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.uom", "UOM")}</th>
                        <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.mrp", "MRP")}</th>
                        <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.shelfLife", "Shelf Life")}</th>
                        <th className="py-2 pr-2">{t("catalog.products.wizard.variantTable.status", "Status")}</th>
                        <th className="py-2 pr-2">{t("catalog.products.detail.updated", "Updated")}</th>
                        <th className="w-20 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((variant) => (
                        <tr key={variant.id} className="border-b border-border/60">
                          <td className="py-2 pr-2 font-medium">{variant.name ?? "—"}</td>
                          <td className="py-2 pr-2">{variant.cf_pack_size ?? "—"}</td>
                          <td className="py-2 pr-2">{variant.cf_uom ?? "—"}</td>
                          <td className="py-2 pr-2 font-medium text-emerald-600 dark:text-emerald-400">
                            {variant.cf_mrp != null ? `₹${variant.cf_mrp}` : "—"}
                          </td>
                          <td className="py-2 pr-2">{variant.cf_shelf_life ?? "—"}</td>
                          <td className="py-2 pr-2">
                            <StatusBadge variant={variant.is_active ? "success" : "neutral"}>
                              {variant.is_active
                                ? t("catalog.products.wizard.variant.active", "Active")
                                : t("catalog.products.wizard.variant.inactive", "Inactive")}
                            </StatusBadge>
                          </td>
                          <td className="py-2 pr-2 text-muted-foreground">{formatDate(variant.updated_at)}</td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditVariantDialog(variant)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteVariant(variant)}
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
        </div>

        {/* Variant Create / Edit Dialog */}
        <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingVariantId
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
                    <SelectValue placeholder="Select Variant Name" />
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
              <div className="space-y-1">
                <Label>{t("catalog.products.wizard.variantTable.packSize", "Pack Size")}</Label>
                <Input
                  value={variantDraft.packSize}
                  onChange={(e) => setVariantDraft((prev) => ({ ...prev, packSize: e.target.value }))}
                  placeholder="e.g. 50, 100, 250"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("catalog.products.wizard.variantTable.uom", "UOM")}</Label>
                <Select
                  value={variantDraft.uom}
                  onValueChange={(val) => setVariantDraft((prev) => ({ ...prev, uom: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select UOM (e.g. ml, KG)" />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("catalog.products.wizard.variantTable.mrp", "MRP (₹)")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={variantDraft.mrp}
                  onChange={(e) => setVariantDraft((prev) => ({ ...prev, mrp: e.target.value }))}
                  placeholder="e.g. 599"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("catalog.products.wizard.variantTable.shelfLife", "Shelf Life")}</Label>
                <Input
                  value={variantDraft.shelfLife}
                  onChange={(e) => setVariantDraft((prev) => ({ ...prev, shelfLife: e.target.value }))}
                  placeholder="e.g. 24 Months"
                />
              </div>
              <label className="flex items-center gap-2 text-sm pt-1">
                <Checkbox
                  checked={variantDraft.isActive}
                  onCheckedChange={(checked) => setVariantDraft((prev) => ({ ...prev, isActive: checked === true }))}
                />
                {t("catalog.products.wizard.variant.active", "Active")}
              </label>
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
