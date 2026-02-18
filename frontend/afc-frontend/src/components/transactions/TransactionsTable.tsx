import { useCallback, useEffect, useMemo, useState } from "react";
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
      return qtyDelta < 0 ? "Released" : "Cancelled";
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
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [childProducts, setChildProducts] = useState<ChildProductName[]>([]);
  const [transactions, setTransactions] = useState<TransactionPayload[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productWarning, setProductWarning] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

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
    { label: "Released/Cancelled", value: "Cancelled" },
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
  };

  /** Check if any filter is active (for empty-state messaging) */
  const hasActiveFilters =
    filters.searchProduct ||
    filters.orderId ||
    filters.filterState !== "All" ||
    filters.filterReason ||
    filters.filterNote ||
    filters.dateFilterMode !== "none";

  const colCount = 7;

  return (
    <>
      {/* ── 1️⃣ Summary Bar ── */}
      <TransactionSummaryBar
        total={summary.total}
        netQuantityChange={summary.net_quantity_change}
        committedCount={summary.committed_count}
        pendingCount={summary.pending_count}
        loading={summaryLoading}
      />

      {/* ── 7️⃣ Preset Filters ── */}
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

      <MDTable
        title="Transactions Ledger"
        columns={[
          "Product",
          "Order",
          "State",
          "Quantity",
          "Reason",
          "Note",
          "Date",
        ]}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      >
        {/* FILTER BAR */}
        <tr className="border-b">

          {/* Product Search */}
          <th className="py-2 pr-2">
            <input
              className="input input-bordered input-xs w-full"
              placeholder="Search Product"
              value={filters.searchProduct}
              onChange={(e) => setFilter("searchProduct", e.target.value)}
            />
          </th>

          {/* Order Filter */}
          <th className="py-2 pr-2">
            <input
              className="input input-bordered input-xs w-full"
              placeholder="Order #"
              value={filters.orderId}
              onChange={(e) => setFilter("orderId", e.target.value)}
            />
          </th>

          {/* State Filter */}
          <th className="py-2 pr-2">
            <select
              className="select select-bordered select-xs w-full"
              value={filters.filterState}
              onChange={(e) => setFilter("filterState", e.target.value)}
            >
              {stateFilterOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </th>

          {/* Quantity - No filter (display only) */}
          <th className="py-2 pr-2"></th>

          {/* Reason Filter */}
          <th className="py-2 pr-2">
            <input
              className="input input-bordered input-xs w-full"
              placeholder="Search Reason"
              value={filters.filterReason}
              onChange={(e) => setFilter("filterReason", e.target.value)}
            />
          </th>

          {/* Note Filter */}
          <th className="py-2 pr-2">
            <input
              className="input input-bordered input-xs w-full"
              placeholder="Search Note"
              value={filters.filterNote}
              onChange={(e) => setFilter("filterNote", e.target.value)}
            />
          </th>

          {/* Date Filter */}
          <th className="py-2 pr-2">
            <div className="flex flex-col gap-1">
              <select
                className="select select-bordered select-xs w-full"
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
                <>
                  <input
                    type="date"
                    className="input input-bordered input-xs w-full"
                    placeholder="Start Date"
                    value={filters.startDate}
                    onChange={(e) => setFilter("startDate", e.target.value)}
                  />
                  <input
                    type="date"
                    className="input input-bordered input-xs w-full"
                    placeholder="End Date"
                    value={filters.endDate}
                    onChange={(e) => setFilter("endDate", e.target.value)}
                  />
                </>
              )}
              
              {(filters.dateFilterMode === "before" || filters.dateFilterMode === "after") && (
                <input
                  type="date"
                  className="input input-bordered input-xs w-full"
                  placeholder={filters.dateFilterMode === "before" ? "Before Date" : "After Date"}
                  value={filters.startDate}
                  onChange={(e) => setFilter("startDate", e.target.value)}
                />
              )}
            </div>
          </th>
    
        </tr>

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

        {/* 8️⃣ Empty-State Messaging */}
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
                ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
              `}
            >
              {/* 6️⃣ Larger product text */}
              <td className="py-3 px-2 font-medium text-gray-900">{row.product}</td>

              {/* 6️⃣ Order as chip */}
              <td className="py-3 px-2">
                {row.orderId ? (
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    Order #{row.orderId}
                  </span>
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

              {/* 3️⃣ Reason badge with color coding */}
              <td className="py-3 px-2">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                    REASON_BADGE_STYLES[row.source] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {getReasonDisplayLabel(row.source)}
                </span>
              </td>

              {/* 6️⃣ Dim empty notes + 2️⃣ Related transaction indicator */}
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
            </tr>
          ))}
      </MDTable>

      {/* ── 4️⃣ Detail Drawer ── */}
      {selectedTxn && (
        <TransactionDetailDrawer
          transaction={selectedTxn}
          productLabel={selectedProductLabel}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </>
  );
}
