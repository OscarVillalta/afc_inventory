import { useCallback, useEffect, useMemo, useState } from "react";
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
    child.misc_item?.name ||
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

    return { resolve };
  }, [products, childProducts]);
}

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
    <div className="shadow-md bg-white px-4 py-2 space-y-4">
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
            

            <div className="grid grid-cols-1 px-3 ">

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
            <button className="btn btn-outline btn-xs w-fit" onClick={() => handleAddSource(draft.id)} disabled={submitting}>
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

      <button className="btn btn-outline btn-sm w-fit" onClick={handleAddDraft} disabled={submitting}>
        + Add New Line Item
      </button>

      <div className="flex justify-end gap-2 pt-1">
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function ConversionsPage() {
  const [batches, setBatches] = useState<ConversionBatchSummary[]>([]);
  const [batchPage, setBatchPage] = useState(1);
  const [totalBatches, setTotalBatches] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversionBatchDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creationMode, setCreationMode] = useState(false);
  const [addMode, setAddMode] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [childProducts, setChildProducts] = useState<ChildProductName[]>([]);

  const { resolve } = useProductLookups(products, childProducts);

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
        if (!creationMode) {
          setSelectedBatchId((prev) => prev ?? res.results?.[0]?.id ?? null);
        }
      })
      .catch(() => setError("Failed to load production batches."))
      .finally(() => setLoadingList(false));
  }, [batchPage, creationMode]);

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
      .then((res) => setDetail(res))
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
      setCreationMode(false);
      setAddMode(false);
      loadBatches();
      if (response?.batch?.id) {
        setSelectedBatchId(response.batch.id);
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
      const results = await Promise.allSettled(conversions.map((conv) => addConversionToBatch(selectedBatchId, conv)));
      const failed = results.filter((r) => r.status === "rejected");

      if (failed.length) {
        const failedConversions = conversions.filter((_, idx) => results[idx]?.status === "rejected");
        const reasons = failed
          .slice(0, 3)
          .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason ?? "Unknown error")));
        const count = failedConversions.length;
        const hiddenCount = count - reasons.length;
        const reasonsText = reasons.map((r) => `- ${r}`).join("\n");
        const noun = count === 1 ? "conversion" : "conversions";
        const moreText = hiddenCount > 0 ? ` (${hiddenCount} additional errors not shown)` : "";
        alert(`Failed to add ${count} ${noun} of ${conversions.length}${moreText}:\n${reasonsText}`);
      } else {
        setAddMode(false);
      }
      fetchConversionBatch(selectedBatchId)
        .then(setDetail)
        .catch(() => setError("Failed to load conversion details."));
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Please verify your inputs and try again.";
      alert(`An error occurred while adding conversions: ${msg}`);
      setAddMode(true);
    }
  };

  const handleRollbackConversion = async (conversionId: number) => {
    if (!selectedBatchId) return;
    try {
      await rollbackConversion(conversionId);
      fetchConversionBatch(selectedBatchId)
        .then(setDetail)
        .catch(() => setError("Failed to load conversion details."));
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Please try again or contact support.";
      alert(`Failed to reverse conversion: ${msg}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalBatches / 10));

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Production Batches</h1>
            <p className="text-sm text-gray-500">Manage production batches and their conversions.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              className="btn btn-primary w-full md:w-auto"
              onClick={() => {
                setCreationMode(true);
                setAddMode(false);
                setSelectedBatchId(null);
              }}
            >
              Create Production Batch
            </button>
            {selectedBatchId && !creationMode && (
              <button
                className="btn w-full md:w-auto"
                onClick={() => {
                  setAddMode(true);
                }}
              >
                Add to Batch
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-error shadow-sm">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-white rounded-lg shadow-sm border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Batches</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{totalBatches}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">This Page</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{batches.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">With Order</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{batches.filter((b) => b.order_id).length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">With Note</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{batches.filter((b) => b.note).length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-md border overflow-hidden flex flex-col lg:h-[70vh]">
            <div className="bg-[#363b4c] text-white px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Production Batches</h2>
              <span className="text-sm text-gray-200">Total: {totalBatches}</span>
            </div>

            <div className="flex-1 lg:overflow-auto">
              {loadingList && (
                <div className="px-4 py-4 text-sm text-gray-500">Loading batches...</div>
              )}

              {!loadingList && batches.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
                  <div className="text-4xl">📦</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">No conversions yet</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Production batches track the conversion of raw materials into finished products.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setCreationMode(true);
                      setAddMode(false);
                      setSelectedBatchId(null);
                    }}
                  >
                    Create Production Batch
                  </button>
                </div>
              )}

              {!loadingList && batches.length > 0 && (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full table-fixed" role="table" aria-label="Production batches">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <th scope="col" className="px-4 py-3">ID</th>
                          <th scope="col" className="px-4 py-3">Order ID</th>
                          <th scope="col" className="px-4 py-3">Note</th>
                          <th scope="col" className="px-4 py-3">Created By</th>
                          <th scope="col" className="px-4 py-3">Created At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {batches.map((batch) => {
                          const active = batch.id === selectedBatchId && !creationMode;
                          return (
                            <tr
                              key={batch.id}
                              className={`cursor-pointer transition-colors ${active ? "bg-slate-50" : "hover:bg-slate-50"}`}
                              onClick={() => {
                                setCreationMode(false);
                                setAddMode(false);
                                setSelectedBatchId(batch.id);
                              }}
                            >
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900 align-middle">
                                <span className="text-[#363b4c]">#{batch.id}</span>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-[#363b4c] align-middle">
                                {batch.order_id ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 align-middle">
                                <div className="truncate" title={batch.note || undefined}>
                                  {batch.note || "—"}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 align-middle">
                                {batch.created_by || "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 align-middle">
                                {formatDateTime(batch.created_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden flex flex-col gap-2 p-3">
                    {batches.map((batch) => {
                      const active = batch.id === selectedBatchId && !creationMode;
                      return (
                        <div
                          key={batch.id}
                          className={`rounded-lg border p-3 cursor-pointer transition-colors ${active ? "border-[#363b4c] bg-slate-50" : "border-gray-200 hover:bg-slate-50"}`}
                          onClick={() => {
                            setCreationMode(false);
                            setAddMode(false);
                            setSelectedBatchId(batch.id);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#363b4c]">#{batch.id}</span>
                            {batch.order_id && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                Order #{batch.order_id}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-gray-600 truncate">{batch.note || "—"}</div>
                          <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                            <span>{batch.created_by || "—"}</span>
                            <span>{formatDateTime(batch.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-gray-200 px-5 py-3 bg-white flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-gray-700">Page {batchPage} / {totalPages}</span>
              <div className="flex gap-2">
                <button className="btn btn-sm w-full sm:w-auto" disabled={batchPage === 1} onClick={() => setBatchPage((p) => Math.max(1, p - 1))}>
                  Prev
                </button>
                <button className="btn btn-sm w-full sm:w-auto" disabled={batchPage >= totalPages} onClick={() => setBatchPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 md:p-5 lg:h-[70vh] lg:overflow-y-auto">
            {creationMode ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Create Production Batch</h2>
                </div>
                <ConversionBuilder
                  onSubmit={handleCreate}
                  onCancel={() => {
                    setCreationMode(false);
                  }}
                  products={products}
                  childProducts={childProducts}
                  includeBatchFields
                  submitLabel="Create batch"
                />
              </>
            ) : loadingDetail ? (
              <div className="text-gray-500">Loading batch details...</div>
            ) : !detail ? (
              <div className="text-gray-500">Select a batch to see details.</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Production Batch #{detail.batch.id}</h2>
                    <p className="text-sm text-gray-600">Order: {detail.batch.order_id ?? "—"} · Created {formatDate(detail.batch.created_at)}</p>
                    <p className="text-sm text-gray-600">Created by: {detail.batch.created_by || "—"}</p>
                    {detail.batch.note && <p className="text-sm text-gray-700">Note: {detail.batch.note}</p>}
                  </div>
                  {!addMode && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setAddMode(true);
                      }}
                    >
                      Add Conversion
                    </button>
                  )}
                </div>

                {addMode ? (
                  <ConversionBuilder
                    onSubmit={handleAddConversion}
                    onCancel={() => {
                      setAddMode(false);
                    }}
                    products={products}
                    childProducts={childProducts}
                    submitLabel="Add conversion"
                  />
                ) : (
                  <div className="space-y-3">
                    {detail.conversions.length === 0 && (
                      <div className="text-gray-500">No conversions in this batch yet.</div>
                    )}
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
                              <button className="btn btn-xs" onClick={() => handleRollbackConversion(conv.id)}>
                                Reverse
                              </button>
                            )}
                          </div>
                        </div>

                        {conv.note && <p className="text-sm text-gray-700 mt-1">Note: {conv.note}</p>}

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm font-semibold text-gray-700 mb-1">Materials Used</p>
                            {conv.decreases.map((dec, idx) => (
                              <div key={idx} className="text-sm text-gray-700 flex justify-between">
                                <span>{resolve(dec.product_id, dec.child_product_id)}</span>
                                <span>-{dec.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm font-semibold text-gray-700 mb-1">Finished Product</p>
                            <div className="text-sm text-gray-700 flex justify-between">
                              <span>{resolve(conv.increase.product_id, conv.increase.child_product_id)}</span>
                              <span>+{conv.increase.quantity}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
