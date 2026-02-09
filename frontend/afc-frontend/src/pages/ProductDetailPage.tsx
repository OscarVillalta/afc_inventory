import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<ProductOrderSummary[]>([]);
  const [outgoingOrders, setOutgoingOrders] = useState<ProductOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [productData, txnData, incomingData, outgoingData] = await Promise.all([
          fetchProductDetail(Number(productId)),
          fetchProductTransactions(Number(productId), 1, 20),
          fetchProductOrders(Number(productId), 'incoming', 5),
          fetchProductOrders(Number(productId), 'outgoing', 5),
        ]);
        setProduct(productData);
        setTransactions(txnData.results);
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
            quantity_delta: 50,
            reason: "receive",
            state: "committed",
            note: "Shipment from supplier",
            created_at: "2026-02-01T10:30:00Z",
          },
          {
            id: 2,
            product_id: Number(productId),
            quantity_delta: -15,
            reason: "shipment",
            state: "committed",
            note: "Order #5678",
            created_at: "2026-02-03T14:20:00Z",
          },
          {
            id: 3,
            product_id: Number(productId),
            quantity_delta: 5,
            reason: "adjustment",
            state: "committed",
            note: "Physical count correction",
            created_at: "2026-02-04T09:15:00Z",
          },
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
          },
          {
            id: 2,
            order_number: "PO-1235",
            type: "incoming",
            cs_name: "Filter Dynamics Inc.",
            status: "Committed",
            created_at: "2026-01-20T10:00:00Z",
            eta: "2026-03-22",
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
          },
          {
            id: 4,
            order_number: "ORD-5679",
            type: "outgoing",
            cs_name: "XYZ Inc",
            status: "Completed",
            created_at: "2026-02-03T10:00:00Z",
          },
        ]);
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
                        <td className="py-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            order.status === 'Completed' 
                              ? 'bg-green-100 text-green-700'
                              : order.status.includes('Partial')
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
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
                        <td className="py-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            order.status === 'Completed' 
                              ? 'bg-green-100 text-green-700'
                              : order.status.includes('Partial')
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
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
