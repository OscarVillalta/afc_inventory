import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";

import MainLayout from "../../layouts/MainLayout";
import {
  fetchProductDetail,
  fetchProductTransactions,
  type ProductDetail,
  type TransactionItem,
} from "../../api/productDetail";

/* ============================================================
   TYPES
============================================================ */

interface StockProjection {
  date: string;
  level: number;
  annotation?: string;
}

/* ============================================================
   COMPONENT
============================================================ */

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [productData, txnData] = await Promise.all([
          fetchProductDetail(Number(productId)),
          fetchProductTransactions(Number(productId), 1, 20),
        ]);
        setProduct(productData);
        setTransactions(txnData.results);
      } catch (error) {
        console.error("Failed to load product detail:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [productId]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Loading product details...</p>
        </div>
      </MainLayout>
    );
  }

  if (!product) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-red-500">Product not found</p>
        </div>
      </MainLayout>
    );
  }

  // Generate mock projection data (in real app, this would come from backend)
  const generateStockProjection = (): StockProjection[] => {
    const data: StockProjection[] = [];
    const today = new Date();
    let level = product.quantity.on_hand;

    for (let i = 0; i <= 90; i += 10) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      // Simulate stock depletion and restocking
      if (i === 0) {
        data.push({ date: dateStr, level });
      } else if (i === 30) {
        level -= 15;
        data.push({ date: dateStr, level, annotation: "Backorder" });
      } else if (i === 50) {
        level += 25;
        data.push({ date: dateStr, level, annotation: "Restock ETA" });
      } else {
        level -= Math.floor(Math.random() * 5);
        data.push({ date: dateStr, level });
      }
    }

    return data;
  };

  const stockProjection = generateStockProjection();

  // Extract details
  const partNumber = product.details.part_number || product.details.name || "N/A";
  const description = product.details.filter_category
    ? `${product.details.height}x${product.details.width}x${product.details.depth} MERV ${product.details.merv_rating} Filter`
    : product.details.description || "No description";
  const vendor = product.details.supplier_name || "N/A";

  const { on_hand, reserved, ordered, available, backordered } = product.quantity;

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 bg-white">
        {/* ========== BREADCRUMB + HEADER ========== */}
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="text-sm text-gray-500">
            <Link to="/inventory" className="hover:text-gray-700">
              Inventory
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">Product Details</span>
          </div>

          {/* Header */}
          <div className="flex items-start gap-6">
            {/* Optional product image */}
            <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#363b4c]">{partNumber}</h1>
              <p className="text-lg text-gray-600 mt-1">{description}</p>

              <div className="flex gap-6 mt-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Part #:</span> {partNumber}
                </div>
                <div>
                  <span className="font-medium">Vendor:</span> {vendor}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== INVENTORY SNAPSHOT ========== */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="On Hand" value={on_hand} />
          <StatCard label="Reserved" value={reserved} />
          <StatCard label="Ordered" value={ordered} />
          <StatCard
            label="Available"
            value={available}
            className={available > 0 ? "text-green-600" : ""}
          />
          <StatCard
            label="Backordered"
            value={backordered}
            className={backordered > 0 ? "text-red-600" : ""}
          />
        </div>

        {/* ========== PROJECTED STOCK LEVEL ========== */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-[#363b4c] mb-4">
            Projected Stock Level
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stockProjection}>
              <defs>
                <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorBackorder" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                style={{ fontSize: "12px" }}
                stroke="#6b7280"
              />
              <YAxis style={{ fontSize: "12px" }} stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                }}
              />
              <ReferenceLine y={0} stroke="#363b4c" strokeWidth={2} />
              <Area
                type="monotone"
                dataKey="level"
                stroke="#363b4c"
                strokeWidth={2}
                fill="url(#colorStock)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ========== SUPPLY & DEMAND TABLES ========== */}
        <div className="grid grid-cols-3 gap-4">
          {/* Incoming Shipments */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#363b4c] text-white px-4 py-3">
              <h3 className="font-semibold">Incoming Shipments</h3>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="pb-2">PO #</th>
                    <th className="pb-2">Qty</th>
                    <th className="pb-2">ETA</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b text-gray-700">
                    <td className="py-2">PO-1234</td>
                    <td className="py-2">50</td>
                    <td className="py-2">Mar 15</td>
                    <td className="py-2">
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        Pending
                      </span>
                    </td>
                  </tr>
                  <tr className="text-gray-700">
                    <td className="py-2">PO-1235</td>
                    <td className="py-2">100</td>
                    <td className="py-2">Mar 22</td>
                    <td className="py-2">
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                        Committed
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Outgoing Orders */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#363b4c] text-white px-4 py-3">
              <h3 className="font-semibold">Outgoing Orders</h3>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="pb-2">Order #</th>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Qty</th>
                    <th className="pb-2">Ship Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b text-gray-700">
                    <td className="py-2">ORD-5678</td>
                    <td className="py-2">ABC Corp</td>
                    <td className="py-2">25</td>
                    <td className="py-2">Mar 10</td>
                  </tr>
                  <tr className="text-gray-700">
                    <td className="py-2">ORD-5679</td>
                    <td className="py-2">XYZ Inc</td>
                    <td className="py-2">15</td>
                    <td className="py-2">Mar 12</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Warnings */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#363b4c] text-white px-4 py-3">
              <h3 className="font-semibold">Warnings</h3>
            </div>
            <div className="p-4 space-y-2">
              {backordered > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-lg">⚠</span>
                  <p className="text-sm text-gray-700">
                    {backordered} units backordered
                  </p>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-yellow-500 text-lg">⚠</span>
                <p className="text-sm text-gray-700">
                  Missing ETA for PO-1234
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== RECENT ACTIVITY ========== */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-[#363b4c] text-white px-4 py-3">
            <h3 className="font-semibold">Recent Activity / Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b bg-gray-50">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                      No recent transactions
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(txn.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-700">
                        {txn.reason}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium ${
                            txn.quantity_delta > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {txn.quantity_delta > 0 ? "+" : ""}
                          {txn.quantity_delta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {txn.note || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

/* ============================================================
   STAT CARD COMPONENT
============================================================ */

interface StatCardProps {
  label: string;
  value: number;
  className?: string;
}

function StatCard({ label, value, className = "" }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${className || "text-[#363b4c]"}`}>
        {value}
      </p>
    </div>
  );
}
