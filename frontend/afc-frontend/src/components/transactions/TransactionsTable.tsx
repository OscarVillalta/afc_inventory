import { useEffect, useMemo, useState } from "react";
import MDTable from "../table/MDtable";
import { fetchTransactions } from "../../api/transactions";
import type { TransactionPayload } from "../../api/transactions";
import { fetchProducts } from "../../api/products";
import type { Product } from "../../api/products";

interface TransactionRow {
  id: string;
  product: string;
  type: "Incoming" | "Outgoing" | "Adjustment";
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

function getType(txn: TransactionPayload): TransactionRow["type"] {
  const reason = txn.reason?.toLowerCase();
  if (reason === "adjustment" || reason === "rollback") {
    return "Adjustment";
  }
  return txn.quantity_delta >= 0 ? "Incoming" : "Outgoing";
}

export default function TransactionsTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // === FILTER STATES (UI only for now) ===
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<TransactionPayload[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productWarning, setProductWarning] = useState<string | null>(null);

  const loadTransactions = () => {
    setLoading(true);
    setError(null);

    Promise.allSettled([
      fetchTransactions(page, pageSize),
      fetchProducts(),
    ])
      .then(([transactionsResult, productsResult]) => {
        if (transactionsResult.status === "fulfilled") {
          setTransactions(transactionsResult.value.results ?? []);
          setTotal(transactionsResult.value.total ?? 0);
        } else {
          setError("Failed to load transactions.");
          setTransactions([]);
          setTotal(0);
        }

        if (productsResult.status === "fulfilled") {
          setProducts(productsResult.value ?? []);
          setProductWarning(null);
        } else {
          setProducts([]);
          setProductWarning("Product names unavailable.");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTransactions();
  }, [page, pageSize]);

  const productLookup = useMemo(() => {
    return new Map(products.map((product) => [product.id, product.part_number]));
  }, [products]);

  const rows = useMemo(() => {
    return transactions.map((txn) => ({
      id: String(txn.id),
      product: productLookup.get(txn.product_id) ?? `#${txn.product_id}`,
      state: txn.state,
      qty: txn.quantity_delta,
      source: txn.reason ?? "",
      note: txn.note ?? "---",
      date: formatDate(txn.created_at),
    }));
  }, [productLookup, transactions]);

  const uniqueTypes = ["All", "Committed", "Pending", "Rolled_Back", "Cancelled"];

  return (
    <MDTable
      title="Transactions Ledger"
      columns={[
        "Product",
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

        <th className="py-2 pr-2 w-1/4">
          <input
            className="input input-bordered input-xs w-full"
            placeholder="Search ID / Product"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </th>


        <th className="py-2 pr-2 w-1/8">
          <select
            className="select select-bordered select-xs w-full"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            {uniqueTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </th>

        <th className="py-2 pr-2 w-1/8"></th>
        <th className="py-2 pr-2 w-1/8"></th>
        <th className="py-2 pr-2 w-1/4"></th>
  
      </tr>

      {/* TABLE ROWS */}
      {loading && (
        <tr>
          <td className="py-4 text-center text-gray-500" colSpan={6}>
            Loading transactions...
          </td>
        </tr>
      )}

      {!loading && error && (
        <tr>
          <td className="py-4 text-center text-red-600" colSpan={6}>
            {error}
          </td>
        </tr>
      )}

      {!loading && !error && productWarning && (
        <tr>
          <td className="py-2 text-center text-amber-600 text-sm" colSpan={6}>
            {productWarning}
          </td>
        </tr>
      )}

      {!loading && !error && rows.length === 0 && (
        <tr>
          <td className="py-4 text-center text-gray-500" colSpan={6}>
            No transactions found.
          </td>
        </tr>
      )}

      {!loading &&
        !error &&
        rows.map((row) => (
          <tr key={row.id} className="bg-white shadow-sm rounded-xl">
            <td className="py-3 px-2">{row.product}</td>

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
