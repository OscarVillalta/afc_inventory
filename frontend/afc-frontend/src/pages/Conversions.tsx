import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import {
  addConversionToBatch,
  createConversionBatch,
  fetchConversionBatch,
  fetchConversionBatches,
  rollbackConversion,
  type ConversionBatchDetail,
  type ConversionBatchSummary,
  type ConversionInput,
} from "../api/conversions";
import { fetchChildProducts, fetchProducts, type ChildProductName, type Product } from "../api/products";

interface SourceInput {
  selection: string;
  quantity: number;
}

interface ConversionDraft {
  id: string;
  sources: SourceInput[];
  targetSelection: string;
  targetQty: number;
  conversionNote: string;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return `${dateFormatter.format(date)} – ${timeFormatter.format(date)}`;
}

function getChildLabel(child: ChildProductName) {
  return (
    child.part_number ||
    child.air_filter?.part_number ||
    child.stock_item?.name ||
    `Child #${child.id}`
  );
}

function useProductLookups(products: Product[], childProducts: ChildProductName[]) {
  return useMemo(() => {
    const productLookup = new Map(products.map((p) => [p.id, p.part_number || `#${p.id}`]));
    const childLookup = new Map(childProducts.map((c) => [c.id, getChildLabel(c)]));

    const resolve = (productId?: number | null, childProductId?: number | null) => {
      if (childProductId != null) return childLookup.get(childProductId) ?? `Child #${childProductId}`;
      if (productId != null) return productLookup.get(productId) ?? `#${productId}`;
      return "—";
    };

    const getProductLink = (productId?: number | null, childProductId?: number | null): string | null => {
      if (childProductId != null) return `/child-products/${childProductId}`;
      if (productId != null) return `/products/${productId}`;
      return null;
    };

    return { resolve, getProductLink };
  }, [products, childProducts]);
}

// ── KPI Card (matches InventoryKpiRow style) ──────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number | string;
  borderColor: string;
  valueColor: string;
}

function KpiCard({ label, value, borderColor, valueColor }: KpiCardProps) {
  return (
    <div
      className={`flex-1 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden min-w-[150px] border-t-4 ${borderColor}`}
    >
      <div className="px-5 py-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
          {label}
        </p>
        <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}

// ── ConversionBuilder ─────────────────────────────────────────────────────────
interface ConversionBuilderProps {
  onSubmit: (conversions: ConversionInput[], extras?: { batchNote?: string; orderId?: number; createdBy?: string }) => Promise<void>;
  onCancel: () => void;
  products: Product[];
  childProducts: ChildProductName[];
  includeBatchFields?: boolean;
  submitLabel: string;
}

function ConversionBuilder({
  onSubmit,
  onCancel,
  products,
  childProducts,
  includeBatchFields = false,
  submitLabel,
}: ConversionBuilderProps) {
  const createEmptyDraft = useCallback(
    (): ConversionDraft => ({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      sources: [
        { selection: "", quantity: 1 },
        { selection: "", quantity: 1 },
      ],
      targetSelection: "",
      targetQty: 1,
      conversionNote: "",
    }),
    [],
  );

  const [drafts, setDrafts] = useState<ConversionDraft[]>([createEmptyDraft()]);
  const [batchNote, setBatchNote] = useState("");
  const [orderId, setOrderId] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleAddDraft = () => setDrafts((prev) => [...prev, createEmptyDraft()]);
  const handleRemoveDraft = (id: string) => {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((draft) => draft.id !== id)));
  };

  const options = useMemo(() => {
    const base = products.map((p) => ({
      value: `product-${p.id}`,
      label: p.part_number || `Product ${p.id}`,
    }));
    const childOpts = childProducts.map((c) => ({
      value: `child-${c.id}`,
      label: getChildLabel(c),
    }));
    return [...base, ...childOpts];
  }, [products, childProducts]);

  const parseSelection = (selection: string) => {
    if (!selection) return null;
    const [kind, id] = selection.split("-");
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) return null;
    return { kind, id: parsedId as number };
  };

  const updateDraft = (id: string, updater: (draft: ConversionDraft) => ConversionDraft) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? updater(d) : d)));
  };

  const updateSource = (draftId: string, index: number, field: keyof SourceInput, value: string | number) => {
    updateDraft(draftId, (draft) => ({
      ...draft,
      sources: draft.sources.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  const handleAddSource = (draftId: string) =>
    updateDraft(draftId, (draft) => ({
      ...draft,
      sources: [...draft.sources, { selection: "", quantity: 1 }],
    }));

  const handleRemoveSource = (draftId: string, index: number) => {
    updateDraft(draftId, (draft) => ({
      ...draft,
      sources: draft.sources.length === 1 ? draft.sources : draft.sources.filter((_, i) => i !== index),
    }));
  };

  const buildConversion = (draft: ConversionDraft) => {
    const parsedSources = draft.sources
      .map((source) => ({
        parsed: parseSelection(source.selection),
        quantity: Number(source.quantity),
      }))
      .filter(
        (s): s is { parsed: { kind: string; id: number }; quantity: number } =>
          Boolean(s.parsed),
      );

    if (!parsedSources.length) {
      alert("Please select at least one material product from the dropdown.");
      return null;
    }

    if (!draft.targetSelection) {
      alert("Please select a finished product from the dropdown.");
      return null;
    }

    const targetQuantity = Number(draft.targetQty);

    if (
      parsedSources.some((s) => !Number.isInteger(s.quantity) || s.quantity <= 0) ||
      !Number.isInteger(targetQuantity) ||
      targetQuantity <= 0
    ) {
      alert("All quantities must be positive whole numbers.");
      return null;
    }

    const target = parseSelection(draft.targetSelection);
    if (!target) {
      alert("Invalid finished product selection. Please choose a valid product option.");
      return null;
    }

    return {
      decreases: parsedSources.map((source) =>
        source.parsed.kind === "child"
          ? { child_product_id: source.parsed.id, quantity: source.quantity }
          : { product_id: source.parsed.id, quantity: source.quantity }
      ),
      increase:
        target.kind === "child"
          ? { child_product_id: target.id, quantity: targetQuantity }
          : { product_id: target.id, quantity: targetQuantity },
      note: draft.conversionNote || undefined,
    } satisfies ConversionInput;
  };

  const resetConversionFields = () => {
    setDrafts([createEmptyDraft()]);
  };

  const handleSubmit = async () => {
    const conversions: ConversionInput[] = [];
    for (const draft of drafts) {
      const built = buildConversion(draft);
      if (!built) return;
      conversions.push(built);
    }

    setSubmitting(true);
    try {
      await onSubmit(
        conversions,
        includeBatchFields
          ? {
              batchNote: batchNote || undefined,
              orderId: orderId ? Number(orderId) : undefined,
              createdBy: createdBy || undefined,
            }
          : undefined,
      );
      resetConversionFields();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {includeBatchFields && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Order ID (optional)
            </label>
            <input
              type="number"
              className="input input-bordered input-sm w-full"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              min={1}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Created By (optional)
            </label>
            <input
              className="input input-bordered input-sm w-full"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Batch Note (optional)
            </label>
            <input
              className="input input-bordered input-sm w-full"
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
            />
          </div>
        </div>
      )}

      {drafts.map((draft, draftIdx) => (
        <div
          key={draft.id}
          className={`flex flex-col lg:flex-row gap-4 ${draftIdx !== drafts.length - 1 ? "border-b pb-4 mb-4" : "border-b pb-4"}`}
        >
          <div className="flex-1 rounded-lg bg-white p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[14px] uppercase tracking-wide text-base-content/60 font-semibold text-black">
                Materials Used
              </p>
              {drafts.length > 1 && (
                <button
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => handleRemoveDraft(draft.id)}
                  disabled={submitting}
                >
                  Remove line
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 px-3">
              <label className="text-[11px] uppercase tracking-wide text-base-content/60 font-semibold flex-1">
                Product
              </label>
              <label className="text-[11px] uppercase tracking-wide text-base-content/60 font-semibold w-28">
                Quantity Used
              </label>

              {draft.sources.map((source, idx) => (
                <div key={idx} className="col-span-2 py-2 relative">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <select
                        className="select select-bordered select-sm w-full mt-1"
                        value={source.selection}
                        onChange={(e) => updateSource(draft.id, idx, "selection", e.target.value)}
                        disabled={submitting}
                      >
                        <option value="">Select product...</option>
                        {options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        className="input input-bordered input-sm w-full mt-1"
                        value={source.quantity}
                        onChange={(e) => updateSource(draft.id, idx, "quantity", Number(e.target.value))}
                        min={1}
                        disabled={submitting}
                      />
                      {draft.sources.length > 1 && (
                        <button
                          className="btn btn-ghost btn-xs btn-square text-error absolute top-5 -right-6"
                          onClick={() => handleRemoveSource(draft.id, idx)}
                          disabled={submitting}
                          aria-label="Remove line item"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-outline btn-xs w-fit"
              onClick={() => handleAddSource(draft.id)}
              disabled={submitting}
            >
              Add material
            </button>
          </div>

          <div className="flex items-center justify-center text-base-content/60 lg:px-2">
            <span className="hidden lg:inline text-2xl">→</span>
            <span className="lg:hidden text-lg">→</span>
          </div>

          <div className="flex-1 bg-white p-3 space-y-3">
            <div>
              <p className="text-[14px] uppercase tracking-wide text-base-content/60 font-semibold text-black">
                Finished Product
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide text-base-content/60 font-semibold">
                    Product
                  </label>
                  <select
                    className="select select-bordered select-sm w-full mt-1"
                    value={draft.targetSelection}
                    onChange={(e) =>
                      updateDraft(draft.id, (prev) => ({
                        ...prev,
                        targetSelection: e.target.value,
                      }))
                    }
                    disabled={submitting}
                  >
                    <option value="">Select product...</option>
                    {options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-32">
                  <label className="text-[11px] uppercase tracking-wide text-base-content/60 font-semibold">
                    Quantity Produced
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm w-full mt-1"
                    value={draft.targetQty}
                    onChange={(e) =>
                      updateDraft(draft.id, (prev) => ({
                        ...prev,
                        targetQty: Number(e.target.value),
                      }))
                    }
                    min={1}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wide text-base-content/60 font-semibold">
                  Note (optional)
                </label>
                <input
                  className="input input-bordered input-sm w-full mt-1"
                  value={draft.conversionNote}
                  onChange={(e) =>
                    updateDraft(draft.id, (prev) => ({
                      ...prev,
                      conversionNote: e.target.value,
                    }))
                  }
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        className="btn btn-outline btn-sm w-fit"
        onClick={handleAddDraft}
        disabled={submitting}
      >
        + Add New Line Item
      </button>

      <div className="flex justify-end gap-2 pt-1">
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ── ConversionBuilderDrawer ───────────────────────────────────────────────────
interface ConversionBuilderDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  products: Product[];
  childProducts: ChildProductName[];
  includeBatchFields?: boolean;
  submitLabel: string;
  onSubmit: (
    conversions: ConversionInput[],
    extras?: { batchNote?: string; orderId?: number; createdBy?: string },
  ) => Promise<void>;
}

function ConversionBuilderDrawer({
  open,
  onClose,
  title,
  products,
  childProducts,
  includeBatchFields,
  submitLabel,
  onSubmit,
}: ConversionBuilderDrawerProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div
          className="px-6 py-4 text-white flex items-center justify-between shrink-0"
          style={{ background: "linear-gradient(90deg, #3A7BD5 0%, #2B60C8 100%)" }}
        >
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-blue-100">Fill in the details below</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white cursor-pointer text-2xl leading-none p-1"
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <ConversionBuilder
            onSubmit={onSubmit}
            onCancel={onClose}
            products={products}
            childProducts={childProducts}
            includeBatchFields={includeBatchFields}
            submitLabel={submitLabel}
          />
        </div>
      </div>
    </>
  );
}

// ── BatchDetailDrawer ─────────────────────────────────────────────────────────
interface BatchDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  detail: ConversionBatchDetail | null;
  loading: boolean;
  addMode: boolean;
  setAddMode: (v: boolean) => void;
  products: Product[];
  childProducts: ChildProductName[];
  resolve: (productId?: number | null, childProductId?: number | null) => string;
  getProductLink: (productId?: number | null, childProductId?: number | null) => string | null;
  onAddConversion: (conversions: ConversionInput[]) => Promise<void>;
  onRollbackConversion: (conversionId: number) => Promise<void>;
}

function BatchDetailDrawer({
  open,
  onClose,
  detail,
  loading,
  addMode,
  setAddMode,
  products,
  childProducts,
  resolve,
  getProductLink,
  onAddConversion,
  onRollbackConversion,
}: BatchDetailDrawerProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Batch Details"
      >
        {/* Header */}
        <div
          className="px-6 py-4 text-white flex items-center justify-between shrink-0"
          style={{ background: "linear-gradient(90deg, #3A7BD5 0%, #2B60C8 100%)" }}
        >
          <div>
            <h2 className="text-lg font-semibold">
              {detail ? `Production Batch #${detail.batch.id}` : "Batch Details"}
            </h2>
            <p className="text-sm text-blue-100">Detail View</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white cursor-pointer text-2xl leading-none p-1"
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {loading && (
            <div className="text-gray-500 text-sm">Loading batch details...</div>
          )}

          {!loading && !detail && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-4">📦</div>
              <p className="text-gray-400 font-medium">Select a batch to view details</p>
              <p className="text-gray-300 text-sm mt-1">Click any row in the table</p>
            </div>
          )}

          {!loading && detail && !addMode && (
            <>
              {/* Batch Meta */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Batch Info
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">Order</p>
                    {detail.batch.order_id ? (
                      <Link
                        to={`/orders/${detail.batch.order_id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Order #{detail.batch.order_id}
                      </Link>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">Created</p>
                    <span className="text-gray-700">{formatDate(detail.batch.created_at)}</span>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">Created By</p>
                    <span className="text-gray-700">{detail.batch.created_by || "—"}</span>
                  </div>
                  {detail.batch.note && (
                    <div className="col-span-2">
                      <p className="text-gray-400 text-xs mb-0.5">Note</p>
                      <span className="text-gray-700">{detail.batch.note}</span>
                    </div>
                  )}
                </div>
              </section>

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Conversions ({detail.conversions.length})
                </h3>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setAddMode(true)}
                >
                  Add Conversion
                </button>
              </div>

              {detail.conversions.length === 0 && (
                <div className="text-gray-500 text-sm">No conversions in this batch yet.</div>
              )}

              <div className="space-y-3">
                {detail.conversions.map((conv) => (
                  <div key={conv.id} className="border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">Conversion #{conv.id}</p>
                        <p className="text-xs text-gray-500">Created {formatDate(conv.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            conv.state === "completed"
                              ? "bg-green-100 text-green-700"
                              : conv.state === "rolled_back"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {conv.state === "rolled_back" ? "Reversed" : conv.state}
                        </span>
                        {conv.state !== "rolled_back" && (
                          <button
                            className="btn btn-xs"
                            onClick={() => onRollbackConversion(conv.id)}
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    </div>

                    {conv.note && (
                      <p className="text-sm text-gray-700 mt-1">Note: {conv.note}</p>
                    )}

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Materials Used</p>
                        {conv.decreases.map((dec, idx) => {
                          const label = resolve(dec.product_id, dec.child_product_id);
                          const href = getProductLink(dec.product_id, dec.child_product_id);
                          return (
                            <div key={idx} className="text-sm text-gray-700 flex justify-between">
                              {href ? (
                                <Link to={href} className="text-blue-600 hover:underline">
                                  {label}
                                </Link>
                              ) : (
                                <span>{label}</span>
                              )}
                              <span>-{dec.quantity}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Finished Product</p>
                        {(() => {
                          const label = resolve(
                            conv.increase.product_id,
                            conv.increase.child_product_id,
                          );
                          const href = getProductLink(
                            conv.increase.product_id,
                            conv.increase.child_product_id,
                          );
                          return (
                            <div className="text-sm text-gray-700 flex justify-between">
                              {href ? (
                                <Link to={href} className="text-blue-600 hover:underline">
                                  {label}
                                </Link>
                              ) : (
                                <span>{label}</span>
                              )}
                              <span>+{conv.increase.quantity}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && detail && addMode && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Add Conversion to Batch #{detail.batch.id}
                </h3>
              </div>
              <ConversionBuilder
                onSubmit={onAddConversion}
                onCancel={() => setAddMode(false)}
                products={products}
                childProducts={childProducts}
                submitLabel="Add conversion"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── ConversionsPage ───────────────────────────────────────────────────────────
type QuickFilter = "all" | "has_order" | "reversed";

const QUICK_FILTERS: { label: string; key: QuickFilter }[] = [
  { label: "All", key: "all" },
  { label: "Has Order", key: "has_order" },
  { label: "Reversed", key: "reversed" },
];

export default function ConversionsPage() {
  const [batches, setBatches] = useState<ConversionBatchSummary[]>([]);
  const [batchPage, setBatchPage] = useState(1);
  const [totalBatches, setTotalBatches] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversionBatchDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);

  // Drawer state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [builderDrawerOpen, setBuilderDrawerOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  // Track batch IDs that have at least one reversed conversion (for "Reversed" filter)
  const [reversedBatchIds, setReversedBatchIds] = useState<Set<number>>(new Set());

  const [products, setProducts] = useState<Product[]>([]);
  const [childProducts, setChildProducts] = useState<ChildProductName[]>([]);

  const { resolve, getProductLink } = useProductLookups(products, childProducts);

  const loadCatalog = useCallback(() => {
    Promise.allSettled([fetchProducts(), fetchChildProducts()]).then(([prod, child]) => {
      if (prod.status === "fulfilled") setProducts(prod.value ?? []);
      if (child.status === "fulfilled") setChildProducts(child.value ?? []);
    });
  }, []);

  const loadBatches = useCallback(() => {
    setLoadingList(true);
    setError(null);
    fetchConversionBatches(batchPage, 10)
      .then((res) => {
        setBatches(res.results || []);
        setTotalBatches(res.total || 0);
      })
      .catch(() => setError("Failed to load production batches."))
      .finally(() => setLoadingList(false));
  }, [batchPage]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (!selectedBatchId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    fetchConversionBatch(selectedBatchId)
      .then((res) => {
        setDetail(res);
        // Track batches that have at least one reversed conversion
        const hasReversed = res.conversions.some((c) => c.state === "rolled_back");
        if (hasReversed) {
          setReversedBatchIds((prev) => new Set([...prev, selectedBatchId]));
        }
      })
      .catch(() => setError("Failed to load conversion details."))
      .finally(() => setLoadingDetail(false));
  }, [selectedBatchId]);

  const handleCreate = async (
    conversions: ConversionInput[],
    extras?: { batchNote?: string; orderId?: number; createdBy?: string },
  ) => {
    try {
      const response = await createConversionBatch({
        note: extras?.batchNote,
        order_id: extras?.orderId,
        created_by: extras?.createdBy,
        conversions,
      });
      setBuilderDrawerOpen(false);
      loadBatches();
      if (response?.batch?.id) {
        setSelectedBatchId(response.batch.id);
        setDetailDrawerOpen(true);
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Please check your inputs and try again.";
      alert(`Failed to create production batch: ${msg}`);
    }
  };

  const handleAddConversion = async (conversions: ConversionInput[]) => {
    if (!selectedBatchId) return;
    try {
      const results = await Promise.allSettled(
        conversions.map((conv) => addConversionToBatch(selectedBatchId, conv)),
      );
      const failed = results.filter((r) => r.status === "rejected");

      if (failed.length) {
        const failedConversions = conversions.filter(
          (_, idx) => results[idx]?.status === "rejected",
        );
        const reasons = failed
          .slice(0, 3)
          .map((r) =>
            r.reason instanceof Error ? r.reason.message : String(r.reason ?? "Unknown error"),
          );
        const count = failedConversions.length;
        const hiddenCount = count - reasons.length;
        const reasonsText = reasons.map((r) => `- ${r}`).join("\n");
        const noun = count === 1 ? "conversion" : "conversions";
        const moreText =
          hiddenCount > 0 ? ` (${hiddenCount} additional errors not shown)` : "";
        alert(
          `Failed to add ${count} ${noun} of ${conversions.length}${moreText}:\n${reasonsText}`,
        );
      } else {
        setAddMode(false);
      }
      fetchConversionBatch(selectedBatchId)
        .then(setDetail)
        .catch(() => setError("Failed to load conversion details."));
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error ? e.message : "Please verify your inputs and try again.";
      alert(`An error occurred while adding conversions: ${msg}`);
      setAddMode(true);
    }
  };

  const handleRollbackConversion = async (conversionId: number) => {
    if (!selectedBatchId) return;
    try {
      await rollbackConversion(conversionId);
      fetchConversionBatch(selectedBatchId)
        .then((res) => {
          setDetail(res);
          const hasReversed = res.conversions.some((c) => c.state === "rolled_back");
          if (hasReversed) {
            setReversedBatchIds((prev) => new Set([...prev, selectedBatchId]));
          }
        })
        .catch(() => setError("Failed to load conversion details."));
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error ? e.message : "Please try again or contact support.";
      alert(`Failed to reverse conversion: ${msg}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalBatches / 10));

  // Client-side filtered batches
  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      if (quickFilter === "has_order" && !batch.order_id) return false;
      if (quickFilter === "reversed" && !reversedBatchIds.has(batch.id)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesBatchId = String(batch.id).includes(q);
        const matchesOrderId = batch.order_id ? String(batch.order_id).includes(q) : false;
        if (!matchesBatchId && !matchesOrderId) return false;
      }
      return true;
    });
  }, [batches, quickFilter, searchQuery, reversedBatchIds]);

  const withOrderCount = useMemo(() => batches.filter((b) => b.order_id).length, [batches]);
  const withNoteCount = useMemo(() => batches.filter((b) => b.note).length, [batches]);

  return (
    <MainLayout>
      <div className="px-3 sm:px-6 space-y-6 pb-8">
        {/* ── Page Header ── */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Production Batches</h1>
            <p className="text-sm text-gray-500">
              Manage production batches and their conversions.
            </p>
          </div>
          <button
            className="btn btn-primary w-full md:w-auto"
            onClick={() => setBuilderDrawerOpen(true)}
          >
            Create Production Batch
          </button>
        </div>

        {error && <div className="alert alert-error shadow-sm">{error}</div>}

        {/* ── KPI Cards (InventoryKpiRow style) ── */}
        <div className="flex flex-wrap gap-4">
          <KpiCard
            label="Total Batches"
            value={totalBatches}
            borderColor="border-blue-500"
            valueColor="text-gray-800"
          />
          <KpiCard
            label="This Page"
            value={batches.length}
            borderColor="border-purple-500"
            valueColor="text-gray-800"
          />
          <KpiCard
            label="With Order"
            value={withOrderCount}
            borderColor="border-green-500"
            valueColor="text-green-600"
          />
          <KpiCard
            label="With Note"
            value={withNoteCount}
            borderColor="border-amber-500"
            valueColor="text-amber-600"
          />
        </div>

        {/* ── Search + Quick-Filter Pills ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1111 5a6 6 0 016 6z"
              />
            </svg>
            <input
              className="input input-bordered input-sm w-full pl-9"
              placeholder="Search Batch ID or Order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  quickFilter === f.key
                    ? "bg-[#3A7BD5] text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Full-Width Batches Table ── */}
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            {loadingList && (
              <div className="px-4 py-6 text-sm text-gray-500">Loading batches...</div>
            )}

            {!loadingList && filteredBatches.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
                <div className="text-4xl">📦</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {batches.length === 0 ? "No conversions yet" : "No matches found"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {batches.length === 0
                      ? "Production batches track the conversion of raw materials into finished products."
                      : "Try adjusting your search or filter."}
                  </p>
                </div>
                {batches.length === 0 && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setBuilderDrawerOpen(true)}
                  >
                    Create Production Batch
                  </button>
                )}
              </div>
            )}

            {!loadingList && filteredBatches.length > 0 && (
              <>
                {/* Desktop table */}
                <table
                  className="w-full border-collapse min-w-[700px] hidden md:table"
                  role="table"
                  aria-label="Production batches"
                >
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Note
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-gray-50/60">
                    {filteredBatches.map((batch) => (
                      <tr
                        key={batch.id}
                        className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                        onClick={() => {
                          setSelectedBatchId(batch.id);
                          setAddMode(false);
                          setDetailDrawerOpen(true);
                        }}
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-blue-600 align-middle">
                          #{batch.id}
                        </td>
                        <td className="px-4 py-3 text-sm align-middle">
                          {batch.order_id ? (
                            <Link
                              to={`/orders/${batch.order_id}`}
                              className="text-blue-600 hover:underline font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              #{batch.order_id}
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 align-middle max-w-[200px]">
                          <div className="truncate" title={batch.note || undefined}>
                            {batch.note || <span className="text-gray-400">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 align-middle">
                          {batch.created_by || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 align-middle">
                          {formatDateTime(batch.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden flex flex-col gap-2 p-3">
                  {filteredBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        setSelectedBatchId(batch.id);
                        setAddMode(false);
                        setDetailDrawerOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-600">#{batch.id}</span>
                        {batch.order_id && (
                          <Link
                            to={`/orders/${batch.order_id}`}
                            className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Order #{batch.order_id}
                          </Link>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-600 truncate">
                        {batch.note || "—"}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                        <span>{batch.created_by || "—"}</span>
                        <span>{formatDateTime(batch.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Dark pagination dock ── */}
          <div className="flex items-center justify-between bg-gray-900 text-gray-400 px-4 py-2.5 text-xs gap-4 flex-wrap">
            <span className="text-gray-500">
              Page {batchPage} / {totalPages}&nbsp;·&nbsp;{totalBatches} total
            </span>
            <div className="flex items-center gap-1">
              <button
                className="w-7 h-7 flex items-center justify-center rounded text-sm text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 transition"
                disabled={batchPage <= 1}
                onClick={() => setBatchPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) => p === 1 || p === totalPages || Math.abs(p - batchPage) <= 1,
                )
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((token, idx) =>
                  token === "…" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-gray-600 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={token}
                      onClick={() => setBatchPage(token as number)}
                      className={`w-7 h-7 flex items-center justify-center rounded text-xs transition ${
                        token === batchPage
                          ? "bg-blue-600 text-white font-semibold"
                          : "text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {token}
                    </button>
                  ),
                )}
              <button
                className="w-7 h-7 flex items-center justify-center rounded text-sm text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 transition"
                disabled={batchPage >= totalPages}
                onClick={() => setBatchPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* ── Drawers ── */}
        <ConversionBuilderDrawer
          open={builderDrawerOpen}
          onClose={() => setBuilderDrawerOpen(false)}
          title="Create Production Batch"
          products={products}
          childProducts={childProducts}
          includeBatchFields
          submitLabel="Create batch"
          onSubmit={handleCreate}
        />

        <BatchDetailDrawer
          open={detailDrawerOpen}
          onClose={() => {
            setDetailDrawerOpen(false);
            setAddMode(false);
          }}
          detail={detail}
          loading={loadingDetail}
          addMode={addMode}
          setAddMode={setAddMode}
          products={products}
          childProducts={childProducts}
          resolve={resolve}
          getProductLink={getProductLink}
          onAddConversion={handleAddConversion}
          onRollbackConversion={handleRollbackConversion}
        />
      </div>
    </MainLayout>
  );
}
