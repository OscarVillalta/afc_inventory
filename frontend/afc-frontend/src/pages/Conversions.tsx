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

function formatDate(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
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
  onSubmit: (conversion: ConversionInput, extras?: { batchNote?: string; orderId?: number; createdBy?: string }) => Promise<void>;
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
  const [sources, setSources] = useState<SourceInput[]>([{ selection: "", quantity: 1 }]);
  const [targetSelection, setTargetSelection] = useState("");
  const [targetQty, setTargetQty] = useState(1);
  const [conversionNote, setConversionNote] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [orderId, setOrderId] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const updateSource = (index: number, field: keyof SourceInput, value: string | number) => {
    setSources((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleAddSource = () => setSources((prev) => [...prev, { selection: "", quantity: 1 }]);
  const handleRemoveSource = (index: number) => {
    setSources((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async () => {
    const parsedSources = sources
      .map((source) => ({
        parsed: parseSelection(source.selection),
        quantity: Number(source.quantity),
      }))
      .filter(
        (s): s is { parsed: { kind: string; id: number }; quantity: number } =>
          Boolean(s.parsed),
      );

    if (!parsedSources.length) {
      alert("Please select at least one source product.");
      return;
    }

    if (!targetSelection) {
      alert("Please select a target product.");
      return;
    }

    if (parsedSources.some((s) => s.quantity <= 0) || targetQty <= 0) {
      alert("All quantities must be greater than zero.");
      return;
    }

    const target = parseSelection(targetSelection);
    if (!target) {
      alert("Invalid target selection.");
      return;
    }

    const conversion: ConversionInput = {
      decreases: parsedSources.map((source) =>
        source.parsed.kind === "child"
          ? { child_product_id: source.parsed.id, quantity: source.quantity }
          : { product_id: source.parsed.id, quantity: source.quantity }
      ),
      increase:
        target.kind === "child"
          ? { child_product_id: target.id, quantity: Number(targetQty) }
          : { product_id: target.id, quantity: Number(targetQty) },
      note: conversionNote || undefined,
    };

    setSubmitting(true);
    try {
      await onSubmit(conversion, includeBatchFields ? {
        batchNote: batchNote || undefined,
        orderId: orderId ? Number(orderId) : undefined,
        createdBy: createdBy || undefined,
      } : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {includeBatchFields && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600">Order ID (optional)</label>
            <input
              type="number"
              className="input input-bordered w-full mt-1"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              min={1}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Created By (optional)</label>
            <input
              className="input input-bordered w-full mt-1"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Batch Note (optional)</label>
            <input
              className="input input-bordered w-full mt-1"
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Decrease From</h3>
            <button className="btn btn-ghost btn-xs" onClick={handleAddSource} disabled={submitting}>
              + Add source
            </button>
          </div>

          <div className="space-y-3">
            {sources.map((source, idx) => (
              <div key={idx} className="border rounded-lg p-3 bg-white shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-600">Product</label>
                  {sources.length > 1 && (
                    <button
                      className="btn btn-ghost btn-xs text-red-500"
                      onClick={() => handleRemoveSource(idx)}
                      disabled={submitting}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <select
                  className="select select-bordered w-full"
                  value={source.selection}
                  onChange={(e) => updateSource(idx, "selection", e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select source...</option>
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <div>
                  <label className="text-sm font-medium text-gray-600">Quantity to decrease</label>
                  <input
                    type="number"
                    className="input input-bordered w-full mt-1"
                    value={source.quantity}
                    onChange={(e) => updateSource(idx, "quantity", Number(e.target.value))}
                    min={1}
                    disabled={submitting}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-700 mb-3">Increase To</h3>
          <label className="text-sm font-medium text-gray-600">Product</label>
          <select
            className="select select-bordered w-full mt-1"
            value={targetSelection}
            onChange={(e) => setTargetSelection(e.target.value)}
            disabled={submitting}
          >
            <option value="">Select target...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium text-gray-600 mt-3 block">
            Quantity to increase
          </label>
          <input
            type="number"
            className="input input-bordered w-full mt-1"
            value={targetQty}
            onChange={(e) => setTargetQty(Number(e.target.value))}
            min={1}
            disabled={submitting}
          />

          <label className="text-sm font-medium text-gray-600 mt-3 block">
            Conversion Note (optional)
          </label>
          <input
            className="input input-bordered w-full mt-1"
            value={conversionNote}
            onChange={(e) => setConversionNote(e.target.value)}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="btn" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
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
      .catch(() => setError("Failed to load conversion batches."))
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

  const handleCreate = async (conversion: ConversionInput, extras?: { batchNote?: string; orderId?: number; createdBy?: string }) => {
    try {
      const response = await createConversionBatch({
        note: extras?.batchNote,
        order_id: extras?.orderId,
        created_by: extras?.createdBy,
        conversions: [conversion],
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
      alert(`Failed to create conversion batch: ${msg}`);
    }
  };

  const handleAddConversion = async (conversion: ConversionInput) => {
    if (!selectedBatchId) return;
    try {
      await addConversionToBatch(selectedBatchId, conversion);
      setAddMode(false);
      fetchConversionBatch(selectedBatchId)
        .then(setDetail)
        .catch(() => setError("Failed to load conversion details."));
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Please verify your inputs and try again.";
      alert(`Failed to add conversion to batch: ${msg}`);
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
      alert(`Failed to rollback conversion: ${msg}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalBatches / 10));

  return (
    <MainLayout>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Conversions</h1>
            <p className="text-sm text-gray-500">Manage conversion batches and their conversions.</p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={() => {
                setCreationMode(true);
                setAddMode(false);
                setSelectedBatchId(null);
              }}
            >
              Create Conversion
            </button>
            {selectedBatchId && !creationMode && (
              <button className="btn" onClick={() => setAddMode(true)}>
                Add to Batch
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-error shadow-sm">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3 h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Conversion Batches</h2>
              <span className="text-sm text-gray-500">Total: {totalBatches}</span>
            </div>

            {loadingList && <div className="text-gray-500">Loading batches...</div>}

            {!loadingList && batches.length === 0 && (
              <div className="text-gray-500">No conversion batches found.</div>
            )}

            <div className="space-y-2">
              {batches.map((batch) => {
                const active = batch.id === selectedBatchId && !creationMode;
                return (
                  <button
                    key={batch.id}
                    className={`w-full text-left p-3 rounded-lg border transition ${active ? "border-primary bg-blue-50" : "hover:bg-gray-50"}`}
                    onClick={() => {
                      setCreationMode(false);
                      setAddMode(false);
                      setSelectedBatchId(batch.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">Batch #{batch.id}</span>
                      <span className="text-xs text-gray-500">{formatDate(batch.created_at)}</span>
                    </div>
                    <div className="text-sm text-gray-600">Order: {batch.order_id ?? "—"}</div>
                    <div className="text-sm text-gray-600 line-clamp-1">Note: {batch.note || "—"}</div>
                    <div className="text-xs text-gray-500">Created by: {batch.created_by || "—"}</div>
                    {batch.totals?.conversions != null && (
                      <div className="text-xs text-gray-500">Conversions: {batch.totals.conversions}</div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button className="btn btn-sm" disabled={batchPage === 1} onClick={() => setBatchPage((p) => Math.max(1, p - 1))}>
                Prev
              </button>
              <span className="text-sm text-gray-600">Page {batchPage} / {totalPages}</span>
              <button className="btn btn-sm" disabled={batchPage >= totalPages} onClick={() => setBatchPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5 h-[70vh] overflow-y-auto">
            {creationMode ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-800">Create Conversion Batch</h2>
                </div>
                <ConversionBuilder
                  onSubmit={handleCreate}
                  onCancel={() => setCreationMode(false)}
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
                    <h2 className="text-lg font-semibold text-gray-800">Batch #{detail.batch.id}</h2>
                    <p className="text-sm text-gray-600">Order: {detail.batch.order_id ?? "—"} · Created {formatDate(detail.batch.created_at)}</p>
                    <p className="text-sm text-gray-600">Created by: {detail.batch.created_by || "—"}</p>
                    {detail.batch.note && <p className="text-sm text-gray-700">Note: {detail.batch.note}</p>}
                  </div>
                  {!addMode && (
                    <button className="btn btn-outline btn-sm" onClick={() => setAddMode(true)}>
                      Add Conversion
                    </button>
                  )}
                </div>

                {addMode ? (
                  <ConversionBuilder
                    onSubmit={handleAddConversion}
                    onCancel={() => setAddMode(false)}
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
                              {conv.state}
                            </span>
                            {conv.state !== "rolled_back" && (
                              <button className="btn btn-xs" onClick={() => handleRollbackConversion(conv.id)}>
                                Rollback
                              </button>
                            )}
                          </div>
                        </div>

                        {conv.note && <p className="text-sm text-gray-700 mt-1">Note: {conv.note}</p>}

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm font-semibold text-gray-700 mb-1">Decrease</p>
                            {conv.decreases.map((dec, idx) => (
                              <div key={idx} className="text-sm text-gray-700 flex justify-between">
                                <span>{resolve(dec.product_id, dec.child_product_id)}</span>
                                <span>-{dec.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm font-semibold text-gray-700 mb-1">Increase</p>
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
