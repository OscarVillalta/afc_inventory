import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MDTable from "../table/MDtable";
import { fetchTransactions, fetchTransactionSummary, type TransactionFilters } from "../../api/transactions";
import type { TransactionPayload, TransactionSummary } from "../../api/transactions";
import { fetchChildProducts, fetchProducts } from "../../api/products";
import type { ChildProductName, Product } from "../../api/products";
import { usePersistedFilters } from "../../hooks/usePersistedFilters";
import TransactionSummaryBar from "./TransactionSummaryBar";
import TransactionDetailDrawer from "./TransactionDetailDrawer";

interface TransactionRow {
  id: string;
  product: string;
  order: string;
  orderId: number | null;
  state: "pending" | "committed" | "cancelled" | "rolled_back";
  qty: number;
  source: string;      // vendor or customer
  note: string;
  date: string;        // formatted date
  lastUpdated: string; // formatted last_updated_at
  isRollback: boolean;
  relatedTxnId: string | null;
  rawTxn: TransactionPayload;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function getChildPartNumber(cp: ChildProductName) {
  return (
    cp.part_number ||
    cp.air_filter?.part_number ||
    cp.misc_item?.name ||
    `Child #${cp.id}`
  );
}

function getStateDisplayLabel(state: string, qtyDelta: number) {
  switch (state) {
    case "pending":
      return qtyDelta < 0 ? "Reserved" : "Ordered";
    case "committed":
      return qtyDelta < 0 ? "Fulfilled" : "Received";
    case "rolled_back":
      return "Reversed";
    case "cancelled":
      return "Cancelled";
    default:
      return state;
  }
}

const ROLLBACK_NOTE_PREFIX = "Reversal of transaction #";

const REASON_BADGE_STYLES: Record<string, string> = {
  adjustment: "bg-gray-100 text-gray-600",
  shipment: "bg-red-50 text-red-700",
  receive: "bg-green-50 text-green-700",
  rollback: "bg-amber-50 text-amber-700",
  ordered: "bg-blue-50 text-blue-700",
  allocation: "bg-purple-50 text-purple-700",
};

function getReasonDisplayLabel(reason: string) {
  if (reason === "rollback") return "reversal";
  return reason;
}

/** Quick-filter presets */
const PRESET_FILTERS = [
  { label: "Today", key: "today" },
  { label: "This Week", key: "week" },
  { label: "Shipments", key: "shipments" },
  { label: "Adjustments", key: "adjustments" },
  { label: "Reversals", key: "reversals" },
  { label: "Arrival", key: "arrival" },
] as const;

function getPresetDates(preset: string) {
  const today = new Date();
  const yyyy = (d: Date) => d.toISOString().split("T")[0];

  if (preset === "today") {
    return { startDate: yyyy(today), endDate: yyyy(today), dateFilterMode: "between" as const };
  }
  if (preset === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay()); // Sunday
    return { startDate: yyyy(start), endDate: yyyy(today), dateFilterMode: "between" as const };
  }
  return {};
}

/** Compute a human-readable date range label */
function getDateRangeLabel(
  mode: string,
  startDate: string,
  endDate: string
): string {
  if (mode === "between" && startDate && endDate) {
    return `${startDate} – ${endDate}`;
  }
  if (mode === "before" && startDate) {
    return `Before ${startDate}`;
  }
  if (mode === "after" && startDate) {
    return `After ${startDate}`;
  }
  return "All time";
}

export default function TransactionsTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // === FILTER STATES (PERSISTED) ===
  const [filters, setFilter, clearFilters] = usePersistedFilters("filters_transactions", {
    searchProduct: "",
    orderId: "",
    filterState: "All",
    filterReason: "",
    filterNote: "",
    startDate: "",
    endDate: "",
    dateFilterMode: "none" as "between" | "before" | "after" | "none",
    lastUpdatedStart: "",
    lastUpdatedEnd: "",
    lastUpdatedMode: "none" as "between" | "before" | "after" | "none",
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [childProducts, setChildProducts] = useState<ChildProductName[]>([]);
  const [transactions, setTransactions] = useState<TransactionPayload[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productWarning, setProductWarning] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Summary bar state
  const [summary, setSummary] = useState<TransactionSummary>({
    total: 0,
    net_quantity_change: 0,
    committed_count: 0,
    pending_count: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Detail drawer state
  const [selectedTxn, setSelectedTxn] = useState<TransactionPayload | null>(null);
  const [selectedProductLabel, setSelectedProductLabel] = useState("");

  /** Build API filters from persisted filter state */
  const buildApiFilters = useCallback((): TransactionFilters => {
    const apiFilters: TransactionFilters = {};
    if (filters.searchProduct) apiFilters.product_name = filters.searchProduct;
    if (filters.orderId) apiFilters.order_id = Number(filters.orderId);
    if (filters.filterState && filters.filterState !== "All") apiFilters.state = filters.filterState;
    if (filters.filterReason) apiFilters.reason = filters.filterReason;
    if (filters.filterNote) apiFilters.note = filters.filterNote;

    if (filters.dateFilterMode === "between" && filters.startDate && filters.endDate) {
      apiFilters.start_date = filters.startDate;
      apiFilters.end_date = filters.endDate;
    } else if (filters.dateFilterMode === "before" && filters.startDate) {
      apiFilters.before_date = filters.startDate;
    } else if (filters.dateFilterMode === "after" && filters.startDate) {
      apiFilters.after_date = filters.startDate;
    }
    return apiFilters;
  }, [filters]);

  const loadTransactions = () => {
    setLoading(true);
    setSummaryLoading(true);
    setError(null);
    setProductWarning(null);

    const apiFilters = buildApiFilters();

    Promise.allSettled([
      fetchTransactions(page, pageSize, apiFilters),
      fetchProducts(),
      fetchChildProducts(),
      fetchTransactionSummary(apiFilters),
    ])
      .then(([transactionsResult, productsResult, childProductsResult, summaryResult]) => {
        if (transactionsResult.status === "fulfilled") {
          setTransactions(transactionsResult.value.results ?? []);
          setTotal(transactionsResult.value.total ?? 0);
        } else {
          setError("Failed to load transactions.");
          setTransactions([]);
          setTotal(0);
        }

        const warnings: string[] = [];

        if (productsResult.status === "fulfilled") {
          setProducts(productsResult.value ?? []);
        } else {
          setProducts([]);
          warnings.push("Products unavailable.");
        }

        if (childProductsResult.status === "fulfilled") {
          setChildProducts(childProductsResult.value ?? []);
        } else {
          setChildProducts([]);
          warnings.push("Child products unavailable.");
        }

        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value);
        }

        if (warnings.length) {
          setProductWarning(warnings.join(" "));
        }
      })
      .finally(() => {
        setLoading(false);
        setSummaryLoading(false);
      });
  };

  useEffect(() => {
    loadTransactions();
  }, [page, pageSize, filters.searchProduct, filters.orderId, filters.filterState, filters.filterReason, filters.filterNote, filters.startDate, filters.endDate, filters.dateFilterMode]);

  const productLookup = useMemo(() => {
    return new Map(products.map((product) => [product.id, product.part_number]));
  }, [products]);

  const childProductLookup = useMemo(() => {
    return new Map(
      childProducts.map((cp) => [cp.id, getChildPartNumber(cp) ?? `Child #${cp.id}`])
    );
  }, [childProducts]);

  const resolveProductLabel = useCallback(
    (txn: TransactionPayload) => {
      if (txn.child_product_id) {
        return childProductLookup.get(txn.child_product_id) ?? `Child #${txn.child_product_id}`;
      }
      if (txn.product_id != null) {
        return productLookup.get(txn.product_id) ?? `#${txn.product_id}`;
      }
      return "—";
    },
    [childProductLookup, productLookup]
  );

  const rows = useMemo<TransactionRow[]>(() => {
    return transactions.map((txn) => {
      const isRollback =
        txn.reason === "rollback" && !!txn.note?.startsWith(ROLLBACK_NOTE_PREFIX);
      const relatedTxnId = isRollback
        ? txn.note!.replace(ROLLBACK_NOTE_PREFIX, "")
        : null;

      return {
        id: String(txn.id),
        product: resolveProductLabel(txn),
        order: txn.order_id ? `Order #${txn.order_id}` : "—",
        orderId: txn.order_id ?? null,
        state: txn.state,
        qty: txn.quantity_delta,
        source: txn.reason ?? "",
        note: txn.note ?? "",
        date: formatDate(txn.created_at),
        lastUpdated: formatDate(txn.last_updated_at),
        isRollback,
        relatedTxnId,
        rawTxn: txn,
      };
    });
  }, [childProductLookup, productLookup, transactions]);

  const stateFilterOptions = [
    { label: "All", value: "All" },
    { label: "Fulfilled/Received", value: "Committed" },
    { label: "Reserved/Ordered", value: "Pending" },
    { label: "Reversed", value: "Rolled_Back" },
    { label: "Cancelled", value: "Cancelled" },
  ];

  /** Apply a preset filter */
  const applyPreset = (key: string) => {
    if (activePreset === key) {
      // Toggle off – clear all
      clearFilters();
      setActivePreset(null);
      return;
    }

    // Reset filters first
    clearFilters();
    setActivePreset(key);

    const dates = getPresetDates(key);
    if (dates.startDate) setFilter("startDate", dates.startDate);
    if (dates.endDate) setFilter("endDate", dates.endDate);
    if (dates.dateFilterMode) setFilter("dateFilterMode", dates.dateFilterMode);

    if (key === "shipments") setFilter("filterReason", "shipment");
    if (key === "adjustments") setFilter("filterReason", "adjustment");
    if (key === "reversals") setFilter("filterReason", "rollback");
    if (key === "arrival") {
      setFilter("filterState", "Committed");
      setFilter("filterReason", "receive");
    }
  };

  /** Check if any filter is active (for empty-state messaging) */
  const hasActiveFilters =
    filters.searchProduct ||
    filters.orderId ||
    filters.filterState !== "All" ||
    filters.filterReason ||
    filters.filterNote ||
    filters.dateFilterMode !== "none";

  const dateRangeLabel = getDateRangeLabel(
    filters.dateFilterMode,
    filters.startDate,
    filters.endDate
  );

  const colCount = 8;

  return (
    <>
      {/* ── Summary Bar ── */}
      <TransactionSummaryBar
        total={summary.total}
        netQuantityChange={summary.net_quantity_change}
        committedCount={summary.committed_count}
        pendingCount={summary.pending_count}
        loading={summaryLoading}
        hasActiveFilters={!!hasActiveFilters}
        dateRangeLabel={dateRangeLabel}
      />

      {/* ── Preset Filters ── */}
      <div className="flex flex-wrap gap-2 mb-4 pl-10 h-9">
        {PRESET_FILTERS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activePreset === p.key
                ? "bg-[#3A7BD5] text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── 2-Column Workspace ── */}
      <div className="flex gap-6">
        {/* Left Column: Filters + Table */}
        <div className="flex-1 min-w-0">
          {/* ── Collapsible Filters Card ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-10">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="w-full flex items-center justify-between px-5 py-3 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="text-sm font-semibold text-gray-700">Filters</span>
                {hasActiveFilters && (
                  <span className="badge badge-sm badge-primary">Active</span>
                )}
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-gray-400 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {filtersOpen && (
              <div className="px-5 pb-4 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Search Product */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Part Number / Product Name</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="Search product..."
                      value={filters.searchProduct}
                      onChange={(e) => setFilter("searchProduct", e.target.value)}
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">State</label>
                    <select
                      className="select select-bordered select-sm w-full"
                      value={filters.filterState}
                      onChange={(e) => setFilter("filterState", e.target.value)}
                    >
                      {stateFilterOptions.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Reason</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="e.g. shipment, adjustment..."
                      value={filters.filterReason}
                      onChange={(e) => setFilter("filterReason", e.target.value)}
                    />
                  </div>

                  {/* Created Date Range */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Created Date Range</label>
                    <select
                      className="select select-bordered select-sm w-full"
                      value={filters.dateFilterMode}
                      onChange={(e) => {
                        setFilter("dateFilterMode", e.target.value as typeof filters.dateFilterMode);
                        setFilter("startDate", "");
                        setFilter("endDate", "");
                      }}
                    >
                      <option value="none">All Dates</option>
                      <option value="between">Between</option>
                      <option value="before">Before</option>
                      <option value="after">After</option>
                    </select>
                    {filters.dateFilterMode === "between" && (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="date"
                          className="input input-bordered input-sm w-full"
                          value={filters.startDate}
                          onChange={(e) => setFilter("startDate", e.target.value)}
                        />
                        <input
                          type="date"
                          className="input input-bordered input-sm w-full"
                          value={filters.endDate}
                          onChange={(e) => setFilter("endDate", e.target.value)}
                        />
                      </div>
                    )}
                    {(filters.dateFilterMode === "before" || filters.dateFilterMode === "after") && (
                      <input
                        type="date"
                        className="input input-bordered input-sm w-full mt-1"
                        value={filters.startDate}
                        onChange={(e) => setFilter("startDate", e.target.value)}
                      />
                    )}
                  </div>

                  {/* Last Updated Date Range */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Last Updated Date Range</label>
                    <select
                      className="select select-bordered select-sm w-full"
                      value={filters.lastUpdatedMode}
                      onChange={(e) => {
                        setFilter("lastUpdatedMode", e.target.value as typeof filters.lastUpdatedMode);
                        setFilter("lastUpdatedStart", "");
                        setFilter("lastUpdatedEnd", "");
                      }}
                    >
                      <option value="none">All Dates</option>
                      <option value="between">Between</option>
                      <option value="before">Before</option>
                      <option value="after">After</option>
                    </select>
                    {filters.lastUpdatedMode === "between" && (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="date"
                          className="input input-bordered input-sm w-full"
                          value={filters.lastUpdatedStart}
                          onChange={(e) => setFilter("lastUpdatedStart", e.target.value)}
                        />
                        <input
                          type="date"
                          className="input input-bordered input-sm w-full"
                          value={filters.lastUpdatedEnd}
                          onChange={(e) => setFilter("lastUpdatedEnd", e.target.value)}
                        />
                      </div>
                    )}
                    {(filters.lastUpdatedMode === "before" || filters.lastUpdatedMode === "after") && (
                      <input
                        type="date"
                        className="input input-bordered input-sm w-full mt-1"
                        value={filters.lastUpdatedStart}
                        onChange={(e) => setFilter("lastUpdatedStart", e.target.value)}
                      />
                    )}
                  </div>
                </div>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => { clearFilters(); setActivePreset(null); }}
                      className="btn btn-ghost btn-sm text-xs text-gray-500"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Table ── */}
          <MDTable
            title="Transactions Ledger"
            columns={[
              "Product",
              "Order",
              "State",
              "Quantity",
              "Reason",
              "Note",
              "Date Created",
              "Last Updated",
            ]}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            sortLabel="last_updated_at (desc)"
          >
            {/* TABLE ROWS */}
            {loading && (
              <tr>
                <td className="py-4 text-center text-gray-500" colSpan={colCount}>
                  Loading transactions...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td className="py-4 text-center text-red-600" colSpan={colCount}>
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && productWarning && (
              <tr>
                <td className="py-2 text-center text-amber-600 text-sm" colSpan={colCount}>
                  {productWarning}
                </td>
              </tr>
            )}

            {/* Empty-State Messaging */}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td className="py-8 text-center" colSpan={colCount}>
                  <p className="text-gray-500 mb-1">
                    {hasActiveFilters
                      ? "No transactions match this filter."
                      : "No transactions found."}
                  </p>
                  {hasActiveFilters && (
                    <p className="text-gray-400 text-sm">
                      Try adjusting the date range or clearing some filters.
                    </p>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              rows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => {
                    setSelectedTxn(row.rawTxn);
                    setSelectedProductLabel(row.product);
                  }}
                  className={`
                    shadow-sm rounded-xl cursor-pointer transition-colors hover:bg-gray-50
                    ${selectedTxn?.id === row.rawTxn.id ? "ring-2 ring-[#3A7BD5]/30 bg-blue-50/50" : ""}
                    ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                  `}
                >
                  <td className="py-3 px-2 font-medium text-gray-900">
                    {row.rawTxn.child_product_id ? (
                      <Link
                        to={`/child-products/${row.rawTxn.child_product_id}`}
                        className="hover:text-[#3A7BD5] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.product}
                      </Link>
                    ) : row.rawTxn.product_id !== null ? (
                      <Link
                        to={`/products/${row.rawTxn.product_id}`}
                        className="hover:text-[#3A7BD5] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.product}
                      </Link>
                    ) : (
                      row.product
                    )}
                  </td>

                  <td className="py-3 px-2">
                    {row.orderId ? (
                      <Link
                        to={`/orders/${row.orderId}`}
                        className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Order #{row.orderId}
                      </Link>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* State badge */}
                  <td className="py-3 px-2">
                    <span
                      className={`
                        px-3 py-1 rounded-full text-xs font-medium
                        ${
                          row.state === "committed"
                            ? "bg-green-100 text-green-700"
                            : row.state === "pending"
                            ? "bg-[#feeab7] text-[#756334]"
                            : "bg-red-100 text-red-700"
                        }
                      `}
                    >
                      {getStateDisplayLabel(row.state, row.qty)}
                    </span>
                  </td>

                  <td className="py-3 px-2">
                    <span
                      className={`
                        px-3 py-1 rounded-full text-xs font-medium
                        ${
                          row.qty > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }
                      `}
                    >
                      {row.qty > 0 ? "+" : ""}{row.qty}
                    </span>
                  </td>

                  {/* Reason badge with color coding */}
                  <td className="py-3 px-2">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        REASON_BADGE_STYLES[row.source] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {getReasonDisplayLabel(row.source)}
                    </span>
                  </td>

                  {/* Notes / Related transaction indicator */}
                  <td className="py-3 px-2">
                    {row.isRollback && row.relatedTxnId ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-0.5">
                        <span>↔</span>
                        <span>Reversal of #{row.relatedTxnId}</span>
                      </span>
                    ) : row.note ? (
                      <span className="text-gray-600 text-sm">{row.note}</span>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>

                  <td className="py-3 px-2 text-gray-400 text-sm">{row.date}</td>
                  <td className="py-3 px-2 text-gray-400 text-sm">{row.lastUpdated}</td>
                </tr>
              ))}
          </MDTable>
        </div>

        {/* Right Column: Detail Drawer (sticky, desktop only) */}
        <div className="hidden lg:block w-[380px] shrink-0">
          <TransactionDetailDrawer
            transaction={selectedTxn}
            productLabel={selectedProductLabel}
            onClose={() => setSelectedTxn(null)}
          />
        </div>
      </div>

      {/* Mobile Detail Drawer (overlay on small screens) */}
      {selectedTxn && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedTxn(null)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-md z-50">
            <TransactionDetailDrawer
              transaction={selectedTxn}
              productLabel={selectedProductLabel}
              onClose={() => setSelectedTxn(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
