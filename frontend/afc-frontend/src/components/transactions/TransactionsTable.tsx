import { useCallback, useEffect, useMemo, useState } from "react";
import MDTable from "../table/MDtable";
import { fetchTransactions, type TransactionFilters } from "../../api/transactions";
import type { TransactionPayload } from "../../api/transactions";
import { fetchChildProducts, fetchProducts } from "../../api/products";
import type { ChildProductName, Product } from "../../api/products";
import { usePersistedFilters } from "../../hooks/usePersistedFilters";

interface TransactionRow {
  id: string;
  product: string;
  order: string;
  state: "pending" | "committed" | "cancelled" | "rolled_back";
  qty: number;
  source: string;      // vendor or customer
  note: string;
  date: string;        // formatted date
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

export default function TransactionsTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // === FILTER STATES (PERSISTED) ===
  const [filters, setFilter] = usePersistedFilters("filters_transactions", {
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

  const loadTransactions = () => {
    setLoading(true);
    setError(null);
    setProductWarning(null);

    // Build filters object
    const apiFilters: TransactionFilters = {};
    if (filters.searchProduct) apiFilters.product_name = filters.searchProduct;
    if (filters.orderId) apiFilters.order_id = Number(filters.orderId);
    if (filters.filterState && filters.filterState !== "All") apiFilters.state = filters.filterState;
    if (filters.filterReason) apiFilters.reason = filters.filterReason;
    if (filters.filterNote) apiFilters.note = filters.filterNote;
    
    // Date filters based on mode
    if (filters.dateFilterMode === "between" && filters.startDate && filters.endDate) {
      apiFilters.start_date = filters.startDate;
      apiFilters.end_date = filters.endDate;
    } else if (filters.dateFilterMode === "before" && filters.startDate) {
      apiFilters.before_date = filters.startDate;
    } else if (filters.dateFilterMode === "after" && filters.startDate) {
      apiFilters.after_date = filters.startDate;
    }

    Promise.allSettled([
      fetchTransactions(page, pageSize, apiFilters),
      fetchProducts(),
      fetchChildProducts(),
    ])
      .then(([transactionsResult, productsResult, childProductsResult]) => {
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

        if (warnings.length) {
          setProductWarning(warnings.join(" "));
        }
      })
      .finally(() => {
        setLoading(false);
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
    return transactions.map((txn) => ({
      id: String(txn.id),
      product: resolveProductLabel(txn),
      order: txn.order_id ? `Order #${txn.order_id}` : "—",
      state: txn.state,
      qty: txn.quantity_delta,
      source: txn.reason ?? "",
      note: txn.note ?? "---",
      date: formatDate(txn.created_at),
    }));
  }, [childProductLookup, productLookup, transactions]);

  const stateFilterOptions = ["All", "Committed", "Pending", "Rolled_Back", "Cancelled"];

  return (
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
              <option key={t}>{t}</option>
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
          <td className="py-4 text-center text-gray-500" colSpan={7}>
            Loading transactions...
          </td>
        </tr>
      )}

      {!loading && error && (
        <tr>
          <td className="py-4 text-center text-red-600" colSpan={7}>
            {error}
          </td>
        </tr>
      )}

      {!loading && !error && productWarning && (
        <tr>
          <td className="py-2 text-center text-amber-600 text-sm" colSpan={7}>
            {productWarning}
          </td>
        </tr>
      )}

      {!loading && !error && rows.length === 0 && (
        <tr>
          <td className="py-4 text-center text-gray-500" colSpan={7}>
            No transactions found.
          </td>
        </tr>
      )}

      {!loading &&
        !error &&
        rows.map((row) => (
          <tr key={row.id} className="bg-white shadow-sm rounded-xl">
            <td className="py-3 px-2">{row.product}</td>
            <td className="py-3 px-2">{row.order}</td>

            {/* Type badge */}
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
                {row.state}
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
                {row.qty}
              </span>
            </td>


            <td className="py-3 px-2">{row.source}</td>
            <td className="py-3 px-2">{row.note}</td>
            <td className="py-3 px-2 text-gray-500">{row.date}</td>
          </tr>
        ))}
    </MDTable>
  );
}
