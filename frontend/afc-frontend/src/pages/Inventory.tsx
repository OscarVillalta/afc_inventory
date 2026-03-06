import { useEffect, useState } from "react";
import AirFiltersTable from "../components/inventory/AirFiltersTable";
import StockItemsTable from "../components/inventory/StockItemsTable";
import AddProductModal from "../components/inventory/AddProductModal";
import ProduceProductModal from "../components/inventory/ProduceProductModal";
import InventoryKpiRow from "../components/inventory/InventoryKpiRow";
import MainLayout from "../layouts/MainLayout";
import { fetchSuppliers } from "../api/suppliers";
import { fetchAirFilterCategories } from "../api/airfilters";
import { fetchStockItemCategories } from "../api/stockItems";
import type { Supplier } from "../api/suppliers";
import type { AirFilterCategory } from "../api/airfilters";
import type { StockItemCategory } from "../api/stockItems";

type TabKey = "filters" | "stock";
type QuickView = "all" | "low_stock" | "backordered" | "has_orders";

const QUICK_VIEWS: { key: QuickView; label: string; color: string }[] = [
  { key: "all",        label: "All",           color: "bg-gray-100 text-gray-600 hover:bg-gray-200" },
  { key: "low_stock",  label: "Low Stock",     color: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { key: "backordered",label: "Backordered",   color: "bg-red-100 text-red-700 hover:bg-red-200" },
  { key: "has_orders", label: "Has Orders",    color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
];

export default function Inventory() {
  const [tab, setTab] = useState<TabKey>("filters");
  const [quickView, setQuickView] = useState<QuickView>("all");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showProduceProduct, setShowProduceProduct] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  /* ── Page-level filter state ── */
  const [globalSearch, setGlobalSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMerv, setFilterMerv] = useState("");
  const [filterDescription, setFilterDescription] = useState("");
  const [compact, setCompact] = useState(false);

  /* ── Dropdown data ── */
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [airFilterCategories, setAirFilterCategories] = useState<AirFilterCategory[]>([]);
  const [stockItemCategories, setStockItemCategories] = useState<StockItemCategory[]>([]);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => {});
    fetchAirFilterCategories().then(setAirFilterCategories).catch(() => {});
    fetchStockItemCategories().then(setStockItemCategories).catch(() => {});
  }, []);

  const triggerRefresh = () => setRefreshToken((prev) => prev + 1);

  const handleClearFilters = () => {
    setGlobalSearch("");
    setFilterSupplier("");
    setFilterCategory("");
    setFilterMerv("");
    setFilterDescription("");
    setQuickView("all");
  };

  const hasActiveFilters =
    globalSearch !== "" ||
    filterSupplier !== "" ||
    filterCategory !== "" ||
    filterMerv !== "" ||
    filterDescription !== "" ||
    quickView !== "all";

  const categories = tab === "filters" ? airFilterCategories : stockItemCategories;

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 w-full space-y-5">

        {/* ── Global Search Bar ── */}
        <div className="max-w-xl mx-auto w-full">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type="text"
              className="w-full rounded-full border border-gray-200 bg-white shadow-sm pl-9 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              placeholder="Search by part number"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              View, analyze, and manage your data.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition"
              onClick={() => setShowProduceProduct(true)}
            >
              Convert Product
            </button>
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1.5"
              onClick={() => setShowAddProduct(true)}
            >
              <span className="text-base leading-none">+</span>
              Add Item
            </button>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <InventoryKpiRow refreshToken={refreshToken} />

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          {/* Supplier */}
          <div className="flex flex-col gap-0.5 min-w-[140px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Supplier</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-0.5 min-w-[140px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Category</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-0.5 min-w-[140px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Status</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={quickView}
              onChange={(e) => setQuickView(e.target.value as QuickView)}
            >
              <option value="all">All Items</option>
              <option value="low_stock">Low Stock</option>
              <option value="backordered">Backordered</option>
              <option value="has_orders">Has Open Orders</option>
            </select>
          </div>

          {/* MERV (air filters) or blank (stock items) */}
          <div className="flex flex-col gap-0.5 min-w-[120px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {tab === "filters" ? "MERV Rating" : "Type"}
            </label>
            {tab === "filters" ? (
              <select
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={filterMerv}
                onChange={(e) => setFilterMerv(e.target.value)}
              >
                <option value="">Any MERV</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((m) => (
                  <option key={m} value={m}>MERV {m}</option>
                ))}
              </select>
            ) : (
              <select
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                value=""
                disabled
              >
                <option value="">All Types</option>
              </select>
            )}
          </div>

          {/* Description Search */}
          <div className="flex flex-col gap-0.5 min-w-[160px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Description</label>
            <input
              type="text"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Search description…"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
            />
          </div>

          {/* Trailing utilities */}
          <div className="flex items-center gap-3 ml-auto">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setCompact((c) => !c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 transition"
              title={compact ? "Switch to comfortable" : "Switch to compact"}
            >
              {compact ? "Comfortable" : "Compact"}
            </button>
          </div>
        </div>

        {/* ── Tabs + Quick-Filter Pills ── */}
        <div className="flex items-center justify-between border-b border-gray-200">
          {/* Underline tabs */}
          <div className="flex">
            <button
              onClick={() => { setTab("filters"); setFilterCategory(""); setFilterMerv(""); }}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                tab === "filters"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Air Filters
            </button>
            <button
              onClick={() => { setTab("stock"); setFilterCategory(""); setFilterMerv(""); }}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                tab === "stock"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Stock Items
            </button>
          </div>

          {/* Quick-filter pills */}
          <div className="flex gap-1.5 pb-1">
            {QUICK_VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setQuickView(v.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                  quickView === v.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : `border-transparent ${v.color}`
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table Content ── */}
        <div>
          {tab === "filters" && (
            <AirFiltersTable
              refreshToken={refreshToken}
              globalSearch={globalSearch}
              filterSupplier={filterSupplier}
              filterCategory={filterCategory}
              filterMerv={filterMerv ? Number(filterMerv) : undefined}
              filterDescription={filterDescription}
              quickView={quickView}
              compact={compact}
              suppliers={suppliers}
              airFilterCategories={airFilterCategories}
            />
          )}
          {tab === "stock" && (
            <StockItemsTable
              refreshToken={refreshToken}
              globalSearch={globalSearch}
              filterSupplier={filterSupplier}
              filterCategory={filterCategory}
              filterDescription={filterDescription}
              quickView={quickView}
              compact={compact}
              suppliers={suppliers}
              stockItemCategories={stockItemCategories}
            />
          )}
        </div>

        {showAddProduct && (
          <AddProductModal
            open={showAddProduct}
            onClose={() => setShowAddProduct(false)}
            onCreated={triggerRefresh}
          />
        )}

        {showProduceProduct && (
          <ProduceProductModal
            open={showProduceProduct}
            onClose={() => setShowProduceProduct(false)}
            onProduced={triggerRefresh}
          />
        )}

      </div>
    </MainLayout>
  );
}
