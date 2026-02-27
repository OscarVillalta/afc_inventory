import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";

import MainLayout from "../layouts/MainLayout";
import {
  fetchChildProductDetail,
  fetchChildProductLedger,
  type ChildProductDetail,
  type TransactionItem,
  type ProductOrderSummary,
  type LedgerItem,
} from "../api/productDetail";

/* ============================================================
   TYPES
============================================================ */

interface StockProjection {
  date: string;
  level: number;
  annotation?: string;
  order_id?: number | null;
}

interface HistoricalDataPoint {
  date: string;
  raw_date: string;
  stock_level: number;
  quantity_delta: number;
  order_id: number | null;
  transaction_id: number;
  reason: string;
}

/* ============================================================
   COMPONENT
============================================================ */

export default function ChildProductDetailPage() {
  const { childProductId } = useParams<{ childProductId: string }>();
  const navigate = useNavigate();
  const [childProduct, setChildProduct] = useState<ChildProductDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<ProductOrderSummary[]>([]);
  const [outgoingOrders, setOutgoingOrders] = useState<ProductOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Graph tab state
  const [graphTab, setGraphTab] = useState<"projected" | "historical">("projected");
  const [histDays, setHistDays] = useState<30 | 60 | 90 | "custom">(30);
  const [histCustomStart, setHistCustomStart] = useState("");
  const [histCustomEnd, setHistCustomEnd] = useState("");
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [hoveredHistPoint, setHoveredHistPoint] = useState<{
    data: HistoricalDataPoint;
    cx: number;
    cy: number;
  } | null>(null);
  const [hoveredProjPoint, setHoveredProjPoint] = useState<{
    data: StockProjection;
    cx: number;
    cy: number;
  } | null>(null);

  const getDotFill = (isHovered: boolean, hasOrder: boolean): string => {
    if (isHovered) return hasOrder ? "#2563eb" : "#2d3143";
    return hasOrder ? "#3b82f6" : "#363b4c";
  };

  useEffect(() => {
    if (!childProductId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const childProductData = await fetchChildProductDetail(Number(childProductId));
        setChildProduct(childProductData);
        
        // For child products, we might want to fetch transactions and orders
        // related to the child product itself (if the API supports it)
        // For now, we'll use empty arrays
        setTransactions([]);
        setIncomingOrders([]);
        setOutgoingOrders([]);
      } catch (error) {
        console.error("Failed to load child product detail:", error);
        // Use mock data for demonstration when backend is unavailable
        setChildProduct({
          id: Number(childProductId),
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
          quantity: {
            on_hand: 45,
            reserved: 20,
            ordered: 60,
            available: 25,
            backordered: 5,
          },
          parent_product: {
            id: 1,
            category: "Air Filters",
            category_id: 1,
            reference_id: 1,
            details: {
              part_number: "AF-16252-11",
              supplier_name: "Filter Dynamics Inc.",
              filter_category: "MERV 11",
              height: 16,
              width: 25,
              depth: 2,
              merv_rating: 11,
            },
          },
        });
        setTransactions([]);
        setIncomingOrders([]);
        setOutgoingOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [childProductId]);

  // Load ledger data when switching to historical tab
  useEffect(() => {
    if (graphTab !== "historical" || !childProductId) return;

    const loadLedger = async () => {
      setLedgerLoading(true);
      setLedgerError(null);
      try {
        const ledger = await fetchChildProductLedger(Number(childProductId), 1, 500);
        setLedgerItems(ledger.results || []);
      } catch (error) {
        console.error("Failed to load ledger data:", error);
        setLedgerError("Failed to load historical data. Please try again.");
      } finally {
        setLedgerLoading(false);
      }
    };

    loadLedger();
  }, [graphTab, childProductId]);

  const historicalData = useMemo((): HistoricalDataPoint[] => {
    const sorted = [...ledgerItems].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const now = new Date();
    let cutoff: Date | null = null;
    let endDate: Date | null = null;
    if (histDays === "custom") {
      if (histCustomStart) cutoff = new Date(histCustomStart);
      if (histCustomEnd) endDate = new Date(histCustomEnd);
    } else {
      cutoff = new Date();
      cutoff.setDate(now.getDate() - histDays);
    }

    let startingBalance = 0;
    if (cutoff) {
      for (const item of sorted) {
        if (new Date(item.created_at) < cutoff) {
          startingBalance += item.quantity_delta;
        }
      }
    }

    let runningBalance = startingBalance;
    const points: HistoricalDataPoint[] = [];

    for (const item of sorted) {
      const itemDate = new Date(item.created_at);
      if (cutoff && itemDate < cutoff) continue;
      if (endDate && itemDate > endDate) continue;

      runningBalance += item.quantity_delta;
      points.push({
        date: itemDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        raw_date: item.created_at,
        stock_level: runningBalance,
        quantity_delta: item.quantity_delta,
        order_id: item.order_id,
        transaction_id: item.id,
        reason: item.reason,
      });
    }

    return points;
  }, [ledgerItems, histDays, histCustomStart, histCustomEnd]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Loading child product details...</p>
        </div>
      </MainLayout>
    );
  }

  if (!childProduct) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-red-500">Child product not found</p>
        </div>
      </MainLayout>
    );
  }

  // Generate mock projection data (in real app, this would come from backend)
  const generateStockProjection = (): StockProjection[] => {
    const data: StockProjection[] = [];
    const today = new Date();
    let level = childProduct.quantity.on_hand;

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
  const isAirFilter = childProduct.category === "Air Filters";
  const partNumber = childProduct.details.part_number || childProduct.details.name || "N/A";
  const description = childProduct.details.description || null;
  const vendor = childProduct.details.supplier_name || "N/A";

  const { on_hand, reserved, ordered, available, backordered } = childProduct.quantity;

  // Parent product info
  const parentPartNumber = childProduct.parent_product?.details.part_number || 
                          childProduct.parent_product?.details.name || "N/A";
  const parentIsAirFilter = childProduct.parent_product?.details.filter_category !== undefined;
  const parentDescription = childProduct.parent_product?.details.description || null;

  return (
    <MainLayout>
      <div className="p-6  mx-auto space-y-6 bg-white">
        {/* ========== BREADCRUMB + HEADER ========== */}
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="text-sm text-gray-500">
            <Link to="/inventory" className="hover:text-gray-700">
              Inventory
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">Child Product Details</span>
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
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-[#363b4c]">{partNumber}</h1>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  Child Product
                </span>
              </div>

              {isAirFilter ? (
                <div className="mt-3 space-y-1">
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Part #:</span> {partNumber}
                    </div>
                    <div>
                      <span className="font-medium">Vendor:</span> {vendor}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                    <div>
                      <span className="font-medium">Dimensions:</span>{" "}
                      {childProduct.details.height} × {childProduct.details.width} × {childProduct.details.depth}
                    </div>
                    <div>
                      <span className="font-medium">MERV Rating:</span>{" "}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        MERV {childProduct.details.merv_rating}
                      </span>
                    </div>
                  </div>
                  {description && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Description:</span>{" "}
                      {description}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-6 mt-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Part #:</span> {partNumber}
                  </div>
                  {description && (
                    <div>
                      <span className="font-medium">Description:</span> {description}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Vendor:</span> {vendor}
                  </div>
                </div>
              )}
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

        {/* ========== PARENT PRODUCT INFO ========== */}
        {childProduct.parent_product && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#363b4c] text-white px-4 py-3">
              <h3 className="font-semibold">Parent Product</h3>
            </div>
            <div className="p-4">
              <div
                className="border border-gray-200 rounded p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/products/${childProduct.parent_product?.id}`)}
                title="Click to view parent product details"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800 text-lg">{parentPartNumber}</p>
                    {parentIsAirFilter ? (
                      <div className="mt-1 space-y-1">
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                          <span>
                            <span className="font-medium">Dimensions:</span>{" "}
                            {childProduct.parent_product.details.height} × {childProduct.parent_product.details.width} × {childProduct.parent_product.details.depth}
                          </span>
                          <span>
                            <span className="font-medium">MERV:</span>{" "}
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              MERV {childProduct.parent_product.details.merv_rating}
                            </span>
                          </span>
                        </div>
                        {parentDescription && (
                          <p className="text-sm text-gray-600">{parentDescription}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 mt-1">{parentDescription}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Supplier: {childProduct.parent_product.details.supplier_name || "N/A"}
                    </p>
                    <p className="text-xs text-blue-600 mt-2 italic">
                      Note: This child product shares inventory with its parent
                    </p>
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
            </div>
          </div>
        )}

        {/* ========== GRAPH TABS ========== */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            <button
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                graphTab === "projected"
                  ? "border-b-2 border-[#363b4c] text-[#363b4c]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setGraphTab("projected")}
            >
              Projected Stock Level
            </button>
            <button
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                graphTab === "historical"
                  ? "border-b-2 border-[#363b4c] text-[#363b4c]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setGraphTab("historical")}
            >
              Historical Stock Movements
            </button>
          </div>

          <div className="p-6">
            {graphTab === "projected" && (
              <>
                <h2 className="text-xl font-semibold text-[#363b4c] mb-4">
                  Projected Stock Level
                </h2>
                <div
                  className="relative"
                  onMouseLeave={() => setHoveredProjPoint(null)}
                >
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
                    <XAxis dataKey="date" style={{ fontSize: "12px" }} stroke="#6b7280" />
                    <YAxis style={{ fontSize: "12px" }} stroke="#6b7280" />
                    <ReferenceLine y={0} stroke="#363b4c" strokeWidth={2} />
                    <Area
                      type="monotone"
                      dataKey="level"
                      stroke="#363b4c"
                      strokeWidth={2}
                      fill="url(#colorStock)"
                      dot={(props: { cx?: number; cy?: number; payload?: StockProjection }) => {
                        const { cx, cy, payload } = props;
                        if (cx == null || cy == null || !payload) return null;
                        const isHovered = hoveredProjPoint?.data.date === payload.date;
                        return (
                          <circle
                            key={`proj-dot-${payload.date}`}
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 6 : 4}
                            fill={isHovered ? "#2d3143" : "#363b4c"}
                            stroke="white"
                            strokeWidth={2}
                            style={{ cursor: "default" }}
                            onMouseEnter={() => setHoveredProjPoint({ data: payload, cx, cy })}
                          />
                        );
                      }}
                      activeDot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                {hoveredProjPoint && (
                  <div
                    className="pointer-events-none absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm whitespace-nowrap"
                    style={{
                      left: hoveredProjPoint.cx + 12,
                      top: Math.max(4, hoveredProjPoint.cy - 60),
                    }}
                  >
                    <p className="font-semibold text-gray-800">{hoveredProjPoint.data.date}</p>
                    <p className="text-gray-600 mt-1">Stock level: {hoveredProjPoint.data.level}</p>
                    {hoveredProjPoint.data.annotation && (
                      <p className="text-blue-600 mt-1">{hoveredProjPoint.data.annotation}</p>
                    )}
                  </div>
                )}
                </div>
              </>
            )}

            {graphTab === "historical" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h2 className="text-xl font-semibold text-[#363b4c]">
                    Historical Stock Movements
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {([30, 60, 90] as const).map((days) => (
                      <button
                        key={days}
                        onClick={() => setHistDays(days)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          histDays === days
                            ? "bg-[#363b4c] text-white border-[#363b4c]"
                            : "bg-white text-gray-600 border-gray-300 hover:border-[#363b4c]"
                        }`}
                      >
                        Last {days}d
                      </button>
                    ))}
                    <button
                      onClick={() => setHistDays("custom")}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        histDays === "custom"
                          ? "bg-[#363b4c] text-white border-[#363b4c]"
                          : "bg-white text-gray-600 border-gray-300 hover:border-[#363b4c]"
                      }`}
                    >
                      Custom
                    </button>
                    {histDays === "custom" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                          value={histCustomStart}
                          onChange={(e) => setHistCustomStart(e.target.value)}
                        />
                        <span className="text-xs text-gray-500">to</span>
                        <input
                          type="date"
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                          value={histCustomEnd}
                          onChange={(e) => setHistCustomEnd(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {ledgerLoading ? (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    Loading historical data…
                  </div>
                ) : ledgerError ? (
                  <div className="flex items-center justify-center h-[300px] text-red-500">
                    {ledgerError}
                  </div>
                ) : historicalData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    No committed transactions found for the selected timeframe.
                  </div>
                ) : (
                  <div
                    className="relative"
                    onMouseLeave={() => setHoveredHistPoint(null)}
                  >
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={historicalData}>
                      <defs>
                        <linearGradient id="colorHistStock" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" style={{ fontSize: "12px" }} stroke="#6b7280" />
                      <YAxis style={{ fontSize: "12px" }} stroke="#6b7280" />
                      <ReferenceLine y={0} stroke="#363b4c" strokeWidth={2} />
                      <Area
                        type="monotone"
                        dataKey="stock_level"
                        stroke="#363b4c"
                        strokeWidth={2}
                        fill="url(#colorHistStock)"
                        dot={(props: { cx?: number; cy?: number; payload?: HistoricalDataPoint }) => {
                          const { cx, cy, payload } = props;
                          if (cx == null || cy == null || !payload) return null;
                          const hasOrder = Boolean(payload.order_id);
                          const isHovered = hoveredHistPoint?.data.transaction_id === payload.transaction_id;
                          return (
                            <circle
                              key={`dot-${payload.transaction_id}`}
                              cx={cx}
                              cy={cy}
                              r={isHovered ? (hasOrder ? 8 : 6) : (hasOrder ? 6 : 4)}
                              fill={getDotFill(isHovered, hasOrder)}
                              stroke="white"
                              strokeWidth={2}
                              style={{ cursor: hasOrder ? "pointer" : "default" }}
                              onMouseEnter={() => setHoveredHistPoint({ data: payload, cx, cy })}
                              onClick={() => {
                                if (payload.order_id) {
                                  window.open(`/orders/${payload.order_id}`, "_blank");
                                }
                              }}
                            />
                          );
                        }}
                        activeDot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="stock_level"
                        stroke="transparent"
                        dot={false}
                        activeDot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {hoveredHistPoint && (
                    <div
                      className="pointer-events-none absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm whitespace-nowrap"
                      style={{
                        left: hoveredHistPoint.cx + 12,
                        top: Math.max(4, hoveredHistPoint.cy - 60),
                      }}
                    >
                      <p className="font-semibold text-gray-800">
                        {new Date(hoveredHistPoint.data.raw_date).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className={`font-medium mt-1 ${hoveredHistPoint.data.quantity_delta > 0 ? "text-green-600" : "text-red-600"}`}>
                        {hoveredHistPoint.data.quantity_delta > 0 ? "+" : ""}{hoveredHistPoint.data.quantity_delta} units
                      </p>
                      <p className="text-gray-600">Stock level: {hoveredHistPoint.data.stock_level}</p>
                      {hoveredHistPoint.data.order_id && (
                        <p className="text-blue-600 mt-1">Order #{hoveredHistPoint.data.order_id} — click to open</p>
                      )}
                    </div>
                  )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ========== SUPPLY & DEMAND TABLES ========== */}
        <div className="grid grid-cols-3 gap-4">
          {/* Incoming Shipments */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#363b4c] text-white px-4 py-3">
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

          {/* Outgoing Orders */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#363b4c] text-white px-4 py-3">
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
              {backordered === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No warnings</p>
              )}
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
