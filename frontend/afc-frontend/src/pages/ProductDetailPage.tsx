import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";

import MainLayout from "../layouts/MainLayout";
import {
  fetchProductDetail,
  fetchProductTransactions,
  fetchProductOrders,
  type ProductDetail,
  type TransactionItem,
  type ProductOrderSummary,
} from "../api/productDetail";
import { autocommitTxn } from "../api/transactions";

/* ============================================================
   TYPES
============================================================ */

interface StockProjection {
  date: string;
  level: number;
  annotation?: string;
}

/* ============================================================
   CONSTANTS
============================================================ */

const ADJUST_REASONS = ["adjustment", "correction", "lost_damage", "customer_return"];
const ADJUST_REASON_LABELS: Record<string, string> = {
  adjustment: "Adjustment",
  correction: "Inventory Correction",
  lost_damage: "Lost / Damaged",
  customer_return: "Customer Return",
};

/* ============================================================
   COMPONENT
============================================================ */

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<ProductOrderSummary[]>([]);
  const [outgoingOrders, setOutgoingOrders] = useState<ProductOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Adjust Stock modal state
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [adjustOnHand, setAdjustOnHand] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Transaction filter state
  const [txnTypeFilter, setTxnTypeFilter] = useState<"all" | "planned" | "executed" | "reversed" | "adjustments">("all");
  const [txnDateRange, setTxnDateRange] = useState<7 | 30 | 90 | null>(null);

  useEffect(() => {
    if (!productId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const numericProductId = Number(productId);
        const [productData, txnData, incomingData, outgoingData] = await Promise.all([
          fetchProductDetail(numericProductId),
          fetchProductTransactions(numericProductId, 1, 20),
          fetchProductOrders(numericProductId, 'incoming', 5),
          fetchProductOrders(numericProductId, 'outgoing', 5),
        ]);
        setProduct(productData);
        
        let allTransactions = txnData.results || [];

        if (productData.child_products?.length) {
          const childTxnResponses = await Promise.allSettled(
            productData.child_products.map((child) =>
              fetchProductTransactions(undefined, 1, 20, child.id)
            )
          );

          childTxnResponses.forEach((result) => {
            if (result.status === "fulfilled" && result.value?.results) {
              allTransactions = allTransactions.concat(result.value.results);
            }
          });
        }

        allTransactions = allTransactions.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setTransactions(allTransactions);
        setIncomingOrders(incomingData);
        setOutgoingOrders(outgoingData);
      } catch (error) {
        console.error("Failed to load product detail:", error);
        // Use mock data for demonstration when backend is unavailable
        // Product with ID 1 has child products, Product with ID 2 has no children
        const hasChildren = Number(productId) === 1;
        
        setProduct({
          id: Number(productId),
          category: "Air Filters",
          reference_id: 1,
          details: {
            part_number: hasChildren ? "AF-16252-11" : "AF-20304-13",
            supplier_name: "Filter Dynamics Inc.",
            filter_category: hasChildren ? "MERV 11" : "MERV 13",
            height: hasChildren ? 16 : 20,
            width: hasChildren ? 25 : 30,
            depth: 2,
            merv_rating: hasChildren ? 11 : 13,
          },
          quantity: {
            on_hand: 45,
            reserved: 20,
            ordered: 60,
            available: 25,
            backordered: 5,
          },
          child_products: hasChildren ? [
            {
              id: 101,
              category: "Air Filters",
              reference_id: 10,
              details: {
                part_number: "AF-16252-11-ALT",
                supplier_name: "Alternative Filters Co.",
                filter_category: "MERV 11",
                height: 16,
                width: 25,
                depth: 2,
                merv_rating: 11,
              },
            },
            {
              id: 102,
              category: "Air Filters",
              reference_id: 11,
              details: {
                part_number: "AF-16252-11-ECO",
                supplier_name: "Eco Filters Inc.",
                filter_category: "MERV 11",
                height: 16,
                width: 25,
                depth: 2,
                merv_rating: 11,
              },
            },
          ] : [],
        });
        setTransactions([
          {
            id: 1,
            product_id: Number(productId),
            order_id: null,
            quantity_delta: 50,
            reason: "receive",
            state: "committed",
            note: "Shipment from supplier",
            created_at: "2026-02-01T10:30:00Z",
          },
          {
            id: 2,
            product_id: Number(productId),
            order_id: 5678,
            quantity_delta: -15,
            reason: "shipment",
            state: "committed",
            note: "Order #5678",
            created_at: "2026-02-03T14:20:00Z",
          },
          {
            id: 3,
            product_id: Number(productId),
            order_id: null,
            quantity_delta: 5,
            reason: "adjustment",
            state: "committed",
            note: "Physical count correction",
            created_at: "2026-02-04T09:15:00Z",
          },
          ...(hasChildren
            ? [
                {
                  id: 4,
                  product_id: null,
                  child_product_id: 101,
                  order_id: 7890,
                  quantity_delta: -3,
                  reason: "shipment",
                  state: "committed",
                  note: "Child product shipment",
                  created_at: "2026-02-05T11:00:00Z",
                },
              ]
            : []),
        ]);
        setIncomingOrders([
          {
            id: 1,
            order_number: "PO-1234",
            type: "incoming",
            cs_name: "Filter Dynamics Inc.",
            status: "Pending",
            created_at: "2026-01-15T10:00:00Z",
            eta: "2026-03-15",
            quantity: 100,
          },
          {
            id: 2,
            order_number: "PO-1235",
            type: "incoming",
            cs_name: "Filter Dynamics Inc.",
            status: "Committed",
            created_at: "2026-01-20T10:00:00Z",
            eta: "2026-03-22",
            quantity: 50,
          },
        ]);
        setOutgoingOrders([
          {
            id: 3,
            order_number: "ORD-5678",
            type: "outgoing",
            cs_name: "ABC Corp",
            status: "Pending",
            created_at: "2026-02-01T10:00:00Z",
            need_by: "2026-03-01",
            quantity: 20,
          },
          {
            id: 4,
            order_number: "ORD-5679",
            type: "outgoing",
            cs_name: "XYZ Inc",
            status: "Completed",
            created_at: "2026-02-03T10:00:00Z",
            quantity: 10,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [productId]);

  const filteredTxns = useMemo(() => {
    let result = transactions;
    switch (txnTypeFilter) {
      case "planned":
        result = result.filter((t) => t.state === "pending");
        break;
      case "executed":
        result = result.filter((t) => t.state === "committed");
        break;
      case "reversed":
        result = result.filter((t) => t.state === "rolled_back");
        break;
      case "adjustments":
        result = result.filter((t) => ADJUST_REASONS.includes(t.reason));
        break;
    }
    if (txnDateRange) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - txnDateRange);
      result = result.filter((t) => new Date(t.created_at) >= cutoff);
    }
    return result;
  }, [transactions, txnTypeFilter, txnDateRange]);

  const groupedTxns = useMemo(() => {
    const groups: { label: string; txns: TransactionItem[] }[] = [];
    const seen = new Map<string, TransactionItem[]>();
    filteredTxns.forEach((txn) => {
      const key = new Date(txn.created_at).toDateString();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(txn);
    });
    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
    seen.forEach((txns, key) => {
      const label =
        key === todayStr
          ? "Today"
          : key === yesterdayStr
          ? "Yesterday"
          : new Date(key).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
      groups.push({ label, txns });
    });
    return groups;
  }, [filteredTxns]);

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

  // Generate stock projection from real incoming/outgoing order data
  const generateStockProjection = (): StockProjection[] => {
    const data: StockProjection[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Collect future events from real order data
    const events: { date: Date; delta: number; label: string }[] = [];

    outgoingOrders.forEach((order) => {
      const qty = order.quantity;
      const dateStr = order.need_by || order.eta;
      if (qty && dateStr) {
        const date = new Date(dateStr);
        if (date > today) {
          events.push({ date, delta: -qty, label: order.order_number || `Order #${order.id}` });
        }
      }
    });

    incomingOrders.forEach((order) => {
      const qty = order.quantity;
      if (qty && order.eta) {
        const date = new Date(order.eta);
        if (date > today) {
          events.push({ date, delta: qty, label: order.order_number || `PO #${order.id}` });
        }
      }
    });

    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let level = product.quantity.on_hand;
    let eventIdx = 0;

    for (let i = 0; i <= 90; i += 10) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const prevDate = new Date(today);
      prevDate.setDate(prevDate.getDate() + i - 10);

      let annotation: string | undefined;
      while (eventIdx < events.length && events[eventIdx].date <= checkDate) {
        if (i > 0 && events[eventIdx].date > prevDate) {
          level += events[eventIdx].delta;
          annotation = events[eventIdx].label;
        }
        eventIdx++;
      }

      const dateStr = checkDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      data.push({ date: dateStr, level: Math.max(0, level), annotation });
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

  const childProductLookup = new Map(
    (product.child_products ?? []).map((child) => [
      child.id,
      child.details.part_number || child.details.name || `Child #${child.id}`,
    ])
  );

  const getTxnProductLabel = (txn: TransactionItem) => {
    if (txn.child_product_id && childProductLookup.has(txn.child_product_id)) {
      return childProductLookup.get(txn.child_product_id);
    }
    if (txn.product_id === product.id) {
      return partNumber;
    }
    if (txn.product_id) {
      return `#${txn.product_id}`;
    }
    return "—";
  };

  const getOrderLabel = (txn: TransactionItem) =>
    txn.order_id ? `Order #${txn.order_id}` : "—";

  // Status badge helper (consistent across order tables)
  const getOrderStatusBadge = (status: string) => {
    if (status === "Completed") return "bg-green-100 text-green-700";
    if (status === "Committed") return "bg-blue-100 text-blue-700";
    if (status.includes("Partial")) return "bg-blue-100 text-blue-700";
    if (status === "Cancelled") return "bg-gray-100 text-gray-600";
    return "bg-yellow-100 text-yellow-700";
  };

  return (
    <MainLayout>
      <div className="p-6  mx-auto space-y-6 bg-white">
        {/* ========== HEADER ========== */}
        <div className="space-y-4">

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
              <div className="flex items-start justify-between">
                <div>
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
                <button
                  className="btn btn-sm bg-[#363b4c] text-white hover:bg-[#4a5063] border-0 flex-shrink-0"
                  onClick={() => {
                    setAdjustOnHand(on_hand);
                    setAdjustReason("");
                    setAdjustNotes("");
                    setAdjustStockOpen(true);
                  }}
                >
                  Adjust Stock
                </button>
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
            className={available > 0 ? "text-green-600" : " text-gray-600"}
          />
          <StatCard
            label="Backordered"
            value={backordered}
            className={backordered > 0 ? "text-red-600" : "text-gray-600"}
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
        <div className="grid grid-cols-4 gap-4">
          {/* Incoming Shipments */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden col-span-3">
            <div 
              className="bg-[#363b4c] text-white px-4 py-3 cursor-pointer hover:bg-[#4a5063] transition-colors"
              onClick={() => navigate(`/orders/search?type=incoming&product_ids=${productId}`)}
              title="Click to view all incoming orders for this product"
            >
              <h3 className="font-semibold">Incoming Shipments</h3>
            </div>
            <div className="p-4">
              {incomingOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No incoming shipments</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="pb-2">Order #</th>
                      <th className="pb-2">Supplier</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">ETA</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomingOrders.map((order) => (
                      <tr 
                        key={order.id}
                        className="border-b last:border-b-0 text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => navigate(`/orders/${order.id}`)}
                        title="Click to view order details"
                      >
                        <td className="py-2">{order.order_number || `#${order.id}`}</td>
                        <td className="py-2 truncate max-w-[120px]" title={order.cs_name}>
                          {order.cs_name}
                        </td>
                        <td className="py-2 font-medium">
                          {order.quantity != null ? order.quantity : "—"}
                        </td>
                        <td className="py-2 text-gray-500">
                          {order.eta
                            ? new Date(order.eta).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : <span className="text-yellow-600 text-xs">No ETA</span>}
                        </td>
                        <td className="py-2">
                          <span className={`text-xs px-2 py-1 rounded ${getOrderStatusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ========== CHILD PRODUCTS / CREATE CHILD PRODUCT ========== */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden col-span-1">
          <div className="bg-[#363b4c] text-white px-4 py-2">
            <h3 className="font-semibold">Child Products</h3>
          </div>
          <div className="p-4">
            {product.child_products && product.child_products.length > 0 ? (
              <div className="space-y-2">
                {product.child_products.map((child) => {
                  const childPartNumber = child.details.part_number || child.details.name || "N/A";
                  return (
                    <div
                      key={child.id}
                      className="border border-gray-200 rounded p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/child-products/${child.id}`)}
                      title="Click to view child product details"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-800">{childPartNumber}</p>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">No child products</p>
                <button
                  className="bg-[#363b4c] text-white px-6 py-2 rounded hover:bg-[#4a5063] transition-colors"
                  onClick={() => {
                    // TODO: Navigate to create child product page/modal
                    alert("Create Child Product functionality coming soon!");
                  }}
                >
                  Create Child Product
                </button>
              </div>
            )}
          </div>
        </div>

          {/* Outgoing Orders */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden col-span-3">
            <div 
              className="bg-[#363b4c] text-white px-4 py-3 cursor-pointer hover:bg-[#4a5063] transition-colors"
              onClick={() => navigate(`/orders/search?type=outgoing&product_ids=${productId}`)}
              title="Click to view all outgoing orders for this product"
            >
              <h3 className="font-semibold">Outgoing Orders</h3>
            </div>
            <div className="p-4">
              {outgoingOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No outgoing orders</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="pb-2">Order #</th>
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Need By</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outgoingOrders.map((order) => (
                      <tr 
                        key={order.id}
                        className="border-b last:border-b-0 text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => navigate(`/orders/${order.id}`)}
                        title="Click to view order details"
                      >
                        <td className="py-2">{order.order_number || `#${order.id}`}</td>
                        <td className="py-2 truncate max-w-[120px]" title={order.cs_name}>
                          {order.cs_name}
                        </td>
                        <td className="py-2 font-medium">
                          {order.quantity != null ? order.quantity : "—"}
                        </td>
                        <td className="py-2 text-gray-500">
                          {order.need_by
                            ? new Date(order.need_by).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="py-2">
                          <span className={`text-xs px-2 py-1 rounded ${getOrderStatusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
          {/* Header + filters */}
          <div className="bg-[#363b4c] text-white px-4 py-3">
            <h3 className="font-semibold">Recent Activity / Transactions</h3>
          </div>
          <div className="px-4 pt-3 pb-2 border-b flex flex-wrap items-center gap-3">
            {/* Type filter chips */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "planned", "executed", "reversed", "adjustments"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxnTypeFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize ${
                    txnTypeFilter === f
                      ? "bg-[#363b4c] text-white border-[#363b4c]"
                      : "bg-white text-gray-600 border-gray-300 hover:border-[#363b4c]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {/* Date range chips */}
            <div className="flex gap-2 flex-wrap ml-auto">
              {([7, 30, 90] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => setTxnDateRange(txnDateRange === days ? null : days)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    txnDateRange === days
                      ? "bg-[#363b4c] text-white border-[#363b4c]"
                      : "bg-white text-gray-600 border-gray-300 hover:border-[#363b4c]"
                  }`}
                >
                  Last {days}d
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            {groupedTxns.length === 0 ? (
              <p className="px-4 py-6 text-center text-gray-500 text-sm">No transactions match the selected filters</p>
            ) : (
              groupedTxns.map(({ label, txns }) => (
                <div key={label}>
                  {/* Day group header */}
                  <div className="px-4 py-2 bg-gray-50 border-b border-t text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {label}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b bg-white">
                        <th className="px-4 py-2">Time</th>
                        <th className="px-4 py-2">Product</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Quantity</th>
                        <th className="px-4 py-2">Order</th>
                        <th className="px-4 py-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map((txn) => (
                        <tr key={txn.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {new Date(txn.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {getTxnProductLabel(txn)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded capitalize ${
                              txn.reason === "adjustment" ? "bg-gray-100 text-gray-600"
                              : txn.reason === "receive" ? "bg-green-50 text-green-700"
                              : txn.reason === "shipment" ? "bg-red-50 text-red-700"
                              : txn.reason === "rollback" ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                            }`}>
                              {txn.reason}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${txn.quantity_delta > 0 ? "text-green-600" : "text-red-600"}`}>
                              {txn.quantity_delta > 0 ? "+" : ""}{txn.quantity_delta}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {getOrderLabel(txn)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {txn.note || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ========== ADJUST STOCK MODAL ========== */}
        {adjustStockOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white w-[480px] rounded-xl shadow-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Adjust Stock</h2>
                <button
                  className="cursor-pointer hover:scale-110 transition text-gray-500"
                  onClick={() => setAdjustStockOpen(false)}
                >✕</button>
              </div>

              <div className="mb-4">
                <label className="font-medium text-sm text-gray-600">Part Number</label>
                <div className="p-2 mt-1 border rounded-lg bg-gray-100 text-gray-700">{partNumber}</div>
              </div>

              <div className="mb-4">
                <label className="font-medium text-sm text-gray-600">On Hand</label>
                <input
                  type="number"
                  className="input input-bordered w-full mt-1"
                  value={adjustOnHand}
                  min={0}
                  onChange={(e) => setAdjustOnHand(Number(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">Current: {on_hand}. Change will create an inventory transaction.</p>
              </div>

              <div className="mb-4">
                <label className="font-medium text-sm text-gray-600">Reason</label>
                <select
                  className="select select-bordered w-full mt-1"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                >
                  <option value="">Select a reason…</option>
                  {ADJUST_REASONS.map((r) => (
                    <option key={r} value={r}>{ADJUST_REASON_LABELS[r] ?? r}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="font-medium text-sm text-gray-600">Notes</label>
                <textarea
                  className="textarea textarea-bordered w-full mt-1"
                  rows={3}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button className="btn" onClick={() => setAdjustStockOpen(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={adjustSaving}
                  onClick={async () => {
                    const delta = adjustOnHand - on_hand;
                    if (delta === 0) { alert("No quantity change detected."); return; }
                    if (!adjustReason) { alert("Please select a reason."); return; }
                    try {
                      setAdjustSaving(true);
                      await autocommitTxn({ product_id: product.id, quantity_delta: delta, reason: adjustReason, note: adjustNotes });
                      setAdjustStockOpen(false);
                      // Refresh product + transactions
                      const [refreshedProduct, txnData] = await Promise.all([
                        fetchProductDetail(product.id),
                        fetchProductTransactions(product.id, 1, 20),
                      ]);
                      setProduct(refreshedProduct);
                      setTransactions(txnData.results || []);
                    } catch {
                      alert("Failed to adjust stock.");
                    } finally {
                      setAdjustSaving(false);
                    }
                  }}
                >
                  {adjustSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
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
