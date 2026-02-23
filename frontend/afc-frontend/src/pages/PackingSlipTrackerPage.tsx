import { useState, useMemo } from "react";
import React from "react";
import MainLayout from "../layouts/MainLayout";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PackingSlipRow = {
  id: string | number;
  packingSlipNo: string | number;
  customer: string;
  type: "Installation" | "Delivery" | "Shipping" | string;
  status: "Pending" | "Delivered" | "Back Order" | "Not Started" | string;
  lastUpdated: string;
  notes?: string;

  maggieDate?: string;
  maggieStatus?: string;
  isabelDate?: string;
  isabelStatus?: string;
  samDate?: string;
  samStatus?: string;
  gilbertDate?: string;
  gilbertStatus?: string;
  oscarDate?: string;
  oscarStatus?: string;
  raulDate?: string;
  raulStatus?: string;
};

type StepState = "completed" | "pending" | "not-started" | "blocked";

type Step = {
  key: string;
  label: string;
  status: string;
  timestamp: string;
  state: StepState;
};

// ─────────────────────────────────────────────
// Helper: build stepper steps from a row
// ─────────────────────────────────────────────

function resolveState(statusVal: string | undefined, globalStatus: string): StepState {
  if (!statusVal) return "not-started";
  const s = statusVal.toLowerCase();
  if (s.includes("deliver") || s.includes("receiv") || s.includes("finish") || s.includes("complet") || s.includes("done")) return "completed";
  if (s.includes("pending") || s.includes("enter") || s.includes("in progress")) return "pending";
  if (globalStatus.toLowerCase().includes("back order")) return "blocked";
  return "not-started";
}

export function buildSteps(row: PackingSlipRow): Step[] {
  const people: { key: string; label: string; statusField?: string; dateField?: string }[] = [
    { key: "maggie",  label: "Maggie",       statusField: row.maggieStatus,  dateField: row.maggieDate  },
    { key: "isabel",  label: "Isabel",        statusField: row.isabelStatus,  dateField: row.isabelDate  },
    { key: "sam",     label: "Sam",           statusField: row.samStatus,     dateField: row.samDate     },
    { key: "gilbert", label: "Gilbert",       statusField: row.gilbertStatus, dateField: row.gilbertDate },
    { key: "oscar",   label: "Oscar/Carlos",  statusField: row.oscarStatus,   dateField: row.oscarDate   },
    { key: "raul",    label: "Raul",          statusField: row.raulStatus,    dateField: row.raulDate    },
  ];

  return people.map((p) => ({
    key: p.key,
    label: p.label,
    status: p.statusField ?? "",
    timestamp: p.dateField ?? "",
    state: resolveState(p.statusField, row.status),
  }));
}

// ─────────────────────────────────────────────
// Mock Data (25 rows)
// ─────────────────────────────────────────────

const mockData: PackingSlipRow[] = [
  { id: 1,  packingSlipNo: "PS-1001", customer: "Acme Corp",          type: "Installation", status: "Pending",    lastUpdated: "2025-07-10", notes: "Awaiting Maggie sign-off", maggieStatus: "Pending", isabelStatus: "", samStatus: "", gilbertStatus: "", oscarStatus: "", raulStatus: "" },
  { id: 2,  packingSlipNo: "PS-1002", customer: "Beta LLC",           type: "Delivery",     status: "Delivered",  lastUpdated: "2025-07-09", notes: "All clear", maggieStatus: "Delivered", maggieDate: "2025-07-01", isabelStatus: "Delivered", isabelDate: "2025-07-03", samStatus: "Delivered", samDate: "2025-07-05", gilbertStatus: "Delivered", gilbertDate: "2025-07-06", oscarStatus: "Delivered", oscarDate: "2025-07-07", raulStatus: "Delivered", raulDate: "2025-07-09" },
  { id: 3,  packingSlipNo: "PS-1003", customer: "Gamma Industries",   type: "Shipping",     status: "Back Order", lastUpdated: "2025-07-08", notes: "Part OOS", maggieStatus: "Delivered", maggieDate: "2025-07-01", isabelStatus: "Pending", samStatus: "", gilbertStatus: "", oscarStatus: "", raulStatus: "" },
  { id: 4,  packingSlipNo: "PS-1004", customer: "Delta Systems",      type: "Installation", status: "Not Started",lastUpdated: "2025-07-07", notes: "" },
  { id: 5,  packingSlipNo: "PS-1005", customer: "Epsilon Co",         type: "Delivery",     status: "Pending",    lastUpdated: "2025-07-06", notes: "Rush order", maggieStatus: "Entered", maggieDate: "2025-07-05", isabelStatus: "", samStatus: "", gilbertStatus: "", oscarStatus: "", raulStatus: "" },
  { id: 6,  packingSlipNo: "PS-1006", customer: "Zeta Solutions",     type: "Shipping",     status: "Delivered",  lastUpdated: "2025-07-05", maggieStatus: "Delivered", maggieDate: "2025-06-28", isabelStatus: "Delivered", isabelDate: "2025-06-29", samStatus: "Delivered", samDate: "2025-06-30", gilbertStatus: "Delivered", gilbertDate: "2025-07-01", oscarStatus: "Delivered", oscarDate: "2025-07-02", raulStatus: "Delivered", raulDate: "2025-07-05" },
  { id: 7,  packingSlipNo: "PS-1007", customer: "Eta Enterprises",    type: "Installation", status: "Pending",    lastUpdated: "2025-07-04", notes: "Check warehouse B" },
  { id: 8,  packingSlipNo: "PS-1008", customer: "Theta Group",        type: "Delivery",     status: "Back Order", lastUpdated: "2025-07-03", notes: "Supplier delay" },
  { id: 9,  packingSlipNo: "PS-1009", customer: "Iota Tech",          type: "Shipping",     status: "Delivered",  lastUpdated: "2025-07-02", maggieStatus: "Delivered", maggieDate: "2025-06-25", isabelStatus: "Delivered", isabelDate: "2025-06-26", samStatus: "Delivered", samDate: "2025-06-27", gilbertStatus: "Delivered", gilbertDate: "2025-06-28", oscarStatus: "Delivered", oscarDate: "2025-06-29", raulStatus: "Delivered", raulDate: "2025-07-02" },
  { id: 10, packingSlipNo: "PS-1010", customer: "Kappa Manufacturing",type: "Installation", status: "Pending",    lastUpdated: "2025-07-01", maggieStatus: "Pending" },
  { id: 11, packingSlipNo: "PS-1011", customer: "Lambda Retail",      type: "Delivery",     status: "Delivered",  lastUpdated: "2025-06-30", maggieStatus: "Delivered", maggieDate: "2025-06-22", isabelStatus: "Delivered", isabelDate: "2025-06-24", samStatus: "Delivered", samDate: "2025-06-25", gilbertStatus: "Delivered", gilbertDate: "2025-06-27", oscarStatus: "Delivered", oscarDate: "2025-06-28", raulStatus: "Delivered", raulDate: "2025-06-30" },
  { id: 12, packingSlipNo: "PS-1012", customer: "Mu Logistics",       type: "Shipping",     status: "Not Started",lastUpdated: "2025-06-29" },
  { id: 13, packingSlipNo: "PS-1013", customer: "Nu Medical",         type: "Installation", status: "Back Order", lastUpdated: "2025-06-28", notes: "Part backordered" },
  { id: 14, packingSlipNo: "PS-1014", customer: "Xi Pharma",          type: "Delivery",     status: "Pending",    lastUpdated: "2025-06-27", maggieStatus: "In Progress" },
  { id: 15, packingSlipNo: "PS-1015", customer: "Omicron Builds",     type: "Shipping",     status: "Delivered",  lastUpdated: "2025-06-26", maggieStatus: "Delivered", maggieDate: "2025-06-19", isabelStatus: "Delivered", isabelDate: "2025-06-20", samStatus: "Delivered", samDate: "2025-06-21", gilbertStatus: "Delivered", gilbertDate: "2025-06-22", oscarStatus: "Delivered", oscarDate: "2025-06-23", raulStatus: "Delivered", raulDate: "2025-06-26" },
  { id: 16, packingSlipNo: "PS-1016", customer: "Pi Controls",        type: "Installation", status: "Pending",    lastUpdated: "2025-06-25" },
  { id: 17, packingSlipNo: "PS-1017", customer: "Rho Energy",         type: "Delivery",     status: "Delivered",  lastUpdated: "2025-06-24", maggieStatus: "Delivered", maggieDate: "2025-06-17", isabelStatus: "Delivered", isabelDate: "2025-06-18", samStatus: "Delivered", samDate: "2025-06-19", gilbertStatus: "Delivered", gilbertDate: "2025-06-20", oscarStatus: "Delivered", oscarDate: "2025-06-21", raulStatus: "Delivered", raulDate: "2025-06-24" },
  { id: 18, packingSlipNo: "PS-1018", customer: "Sigma Supply",       type: "Shipping",     status: "Back Order", lastUpdated: "2025-06-23", notes: "Back-ordered 3 units" },
  { id: 19, packingSlipNo: "PS-1019", customer: "Tau Contracting",    type: "Installation", status: "Pending",    lastUpdated: "2025-06-22", maggieStatus: "Entered" },
  { id: 20, packingSlipNo: "PS-1020", customer: "Upsilon Hardware",   type: "Delivery",     status: "Delivered",  lastUpdated: "2025-06-21", maggieStatus: "Delivered", maggieDate: "2025-06-14", isabelStatus: "Delivered", isabelDate: "2025-06-15", samStatus: "Delivered", samDate: "2025-06-16", gilbertStatus: "Delivered", gilbertDate: "2025-06-17", oscarStatus: "Delivered", oscarDate: "2025-06-18", raulStatus: "Delivered", raulDate: "2025-06-21" },
  { id: 21, packingSlipNo: "PS-1021", customer: "Phi HVAC",           type: "Installation", status: "Not Started",lastUpdated: "2025-06-20" },
  { id: 22, packingSlipNo: "PS-1022", customer: "Chi Mechanical",     type: "Shipping",     status: "Pending",    lastUpdated: "2025-06-19", notes: "Confirm address" },
  { id: 23, packingSlipNo: "PS-1023", customer: "Psi Electrical",     type: "Delivery",     status: "Delivered",  lastUpdated: "2025-06-18", maggieStatus: "Delivered", maggieDate: "2025-06-11", isabelStatus: "Delivered", isabelDate: "2025-06-12", samStatus: "Delivered", samDate: "2025-06-13", gilbertStatus: "Delivered", gilbertDate: "2025-06-14", oscarStatus: "Delivered", oscarDate: "2025-06-15", raulStatus: "Delivered", raulDate: "2025-06-18" },
  { id: 24, packingSlipNo: "PS-1024", customer: "Omega Plumbing",     type: "Shipping",     status: "Back Order", lastUpdated: "2025-06-17", notes: "Waiting on vendor" },
  { id: 25, packingSlipNo: "PS-1025", customer: "AFC Direct",         type: "Installation", status: "Pending",    lastUpdated: "2025-06-16", maggieStatus: "Delivered", maggieDate: "2025-06-12", isabelStatus: "In Progress" },
];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-semibold ";
  let dotCls = "w-1.5 h-1.5 rounded-full shrink-0 ";
  if (s.includes("deliver") || s.includes("complet")) {
    cls += "bg-green-100 text-green-700";
    dotCls += "bg-green-500";
  } else if (s.includes("pending") || s.includes("progress")) {
    cls += "bg-yellow-100 text-yellow-700";
    dotCls += "bg-yellow-500";
  } else if (s.includes("back order") || s.includes("backorder")) {
    cls += "bg-red-100 text-red-700";
    dotCls += "bg-red-500";
  } else {
    cls += "bg-slate-100 text-slate-600";
    dotCls += "bg-slate-400";
  }
  return (
    <span className={cls}>
      <span className={dotCls} />
      {status || "Not Started"}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const t = type.toLowerCase();
  let cls = "inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-semibold ";
  if (t.includes("installation")) cls += "bg-blue-100 text-blue-700";
  else if (t.includes("delivery")) cls += "bg-teal-100 text-teal-700";
  else if (t.includes("shipping")) cls += "bg-cyan-100 text-cyan-700";
  else cls += "bg-slate-100 text-slate-600";
  return (
    <span className={cls}>
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
      </svg>
      {type}
    </span>
  );
}

function StepCircle({ state }: { state: StepState }) {
  if (state === "completed")
    return (
      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs shrink-0">
        ✓
      </div>
    );
  if (state === "pending")
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs shrink-0">
        ●
      </div>
    );
  if (state === "blocked")
    return (
      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs shrink-0">
        ✕
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0">
      ○
    </div>
  );
}

function ProgressStepper({ steps }: { steps: Step[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-start gap-0 min-w-max">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-start">
            {/* Step */}
            <div className="flex flex-col items-center w-28">
              <StepCircle state={step.state} />
              <span className="text-xs font-semibold text-gray-700 mt-1 text-center">{step.label}</span>
              <span className="text-xs text-gray-500 text-center mt-0.5">
                {step.status || "Not Started"}
              </span>
              {step.timestamp && (
                <span className="text-xs text-gray-400 text-center">{step.timestamp}</span>
              )}
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div className="w-8 h-0.5 bg-gray-200 mt-4 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FilterBar
// ─────────────────────────────────────────────

type FilterTab = "All" | "Pending" | "Delivered" | "Back Order";

interface FilterBarProps {
  data: PackingSlipRow[];
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  search: string;
  onSearchChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onCreateClick: () => void;
}

function FilterBar({
  data,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onCreateClick,
}: FilterBarProps) {
  const counts = useMemo(() => ({
    All: data.length,
    Pending: data.filter((r) => r.status === "Pending").length,
    Delivered: data.filter((r) => r.status === "Delivered").length,
    "Back Order": data.filter((r) => r.status === "Back Order").length,
  }), [data]);

  const tabs: FilterTab[] = ["All", "Pending", "Delivered", "Back Order"];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                activeTab === tab
                  ? "bg-blue-100 text-blue-700 border-blue-300 shadow-sm"
                  : "text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}{" "}
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${
                activeTab === tab ? "bg-blue-200 text-blue-800" : "bg-gray-100 text-gray-500"
              }`}>
                {counts[tab as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>

        {/* Date range + search + button */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="input input-sm border border-gray-200 rounded-lg text-sm"
              placeholder="From"
            />
            <span className="text-gray-400 text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="input input-sm border border-gray-200 rounded-lg text-sm"
              placeholder="To"
            />
          </div>

          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search slip, customer, notes…"
              className="input input-sm border border-gray-200 rounded-lg pl-8 text-sm w-52"
            />
          </div>

          <button
            onClick={onCreateClick}
            className="btn btn-primary btn-sm w-full sm:w-auto"
          >
            + Create Shipment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Expanded Detail Panel
// ─────────────────────────────────────────────

function ExpandedPanel({ row, onCollapse }: { row: PackingSlipRow; onCollapse: () => void }) {
  const steps = buildSteps(row);
  const lastCompleted = [...steps].reverse().find((s) => s.state === "completed");

  return (
    <tr>
      <td colSpan={7} className="p-0 border-b border-slate-200/60">
        <div className="bg-slate-50/60 mx-3 my-2 rounded-xl border border-slate-200/60 p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-base font-bold text-slate-900">{row.packingSlipNo}</span>
              <span className="mx-2 text-slate-400">·</span>
              <span className="text-base font-semibold text-slate-600">{row.customer}</span>
            </div>
            <button
              onClick={onCollapse}
              className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              aria-label="Collapse"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>

          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Progress</p>

          {/* Progress Stepper */}
          <ProgressStepper steps={steps} />

          {/* Footer info */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4 text-sm text-slate-600">
            {lastCompleted && (
              <div>
                <span className="font-medium text-slate-700">Last action: </span>
                {lastCompleted.label} completed
                {lastCompleted.timestamp ? ` at ${lastCompleted.timestamp}` : ""}
              </div>
            )}
            {row.notes && (
              <div>
                <span className="font-medium text-slate-700">Notes: </span>
                {row.notes}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-200/70 text-sm">
      <span className="text-slate-500">{total === 0 ? "No results" : `${start}–${end} of ${total}`}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                page === p
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────

function KpiCards({ data }: { data: PackingSlipRow[] }) {
  const total = data.length;
  const pending = data.filter((r) => r.status === "Pending").length;
  const delivered = data.filter((r) => r.status === "Delivered").length;
  const backOrder = data.filter((r) => r.status === "Back Order").length;

  const cards = [
    { label: "Total Records",   value: total,     color: "text-gray-800" },
    { label: "Pending",         value: pending,   color: "text-yellow-600" },
    { label: "Delivered",       value: delivered, color: "text-green-600" },
    { label: "Back Order",      value: backOrder, color: "text-red-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="stat bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="stat-title text-gray-500 text-sm">{c.label}</div>
          <div className={`stat-value text-2xl font-bold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function PackingSlipTrackerPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [page, setPage] = useState(1);

  // ── Filter logic ──────────────────────────────
  const filtered = useMemo(() => {
    let rows = mockData;

    if (activeTab !== "All") {
      rows = rows.filter((r) => r.status === activeTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.packingSlipNo).toLowerCase().includes(q) ||
          r.customer.toLowerCase().includes(q) ||
          (r.notes ?? "").toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      rows = rows.filter((r) => r.lastUpdated >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((r) => r.lastUpdated <= dateTo);
    }

    return rows;
  }, [activeTab, search, dateFrom, dateTo]);

  // Reset to page 1 when filters change
  const handleTabChange = (tab: FilterTab) => { setActiveTab(tab); setPage(1); };
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleDateFrom = (v: string) => { setDateFrom(v); setPage(1); };
  const handleDateTo = (v: string) => { setDateTo(v); setPage(1); };

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleExpand = (id: string | number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── Page Header ─────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Packing Slip Tracker</h1>
            <p className="text-gray-500 mt-1 text-sm">Track shipment progress through each checkpoint</p>
          </div>
        </div>

        {/* ── Filter Bar ──────────────────────────── */}
        <FilterBar
          data={mockData}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          search={search}
          onSearchChange={handleSearch}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={handleDateFrom}
          onDateToChange={handleDateTo}
          onCreateClick={() => alert("Create Shipment — coming soon")}
        />

        {/* ── KPI Cards ───────────────────────────── */}
        <KpiCards data={mockData} />

        {/* ── Table Card ──────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-3 sm:p-4">

          {/* Table scroll wrapper */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                <col className="w-36" />
                <col />
                <col className="w-36" />
                <col className="w-40" />
                <col className="w-36" />
                <col className="w-14" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60 rounded-tl-xl">
                    Packing Slip #
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    <span className="inline-flex items-center gap-1">
                      Last Updated
                      <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Notes
                  </th>
                  <th className="px-4 py-3 bg-slate-50 border-b border-slate-200/70 rounded-tr-xl w-12" />
                </tr>
              </thead>

              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No records found.
                    </td>
                  </tr>
                )}

                {pageRows.map((row, rowIndex) => (
                  <React.Fragment key={row.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      className={`cursor-pointer transition-colors ${
                        expandedId === row.id
                          ? "bg-blue-50/60"
                          : rowIndex % 2 === 0
                          ? "bg-white hover:bg-slate-100/60"
                          : "bg-slate-50/40 hover:bg-slate-100/60"
                      }`}
                      onClick={() => toggleExpand(row.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(row.id); } }}
                    >
                      <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                        <span className="font-semibold text-slate-900">{row.packingSlipNo}</span>
                      </td>
                      <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50 font-medium text-slate-800 max-w-0">
                        <span className="truncate block" title={row.customer}>{row.customer}</span>
                      </td>
                      <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                        <TypePill type={row.type} />
                      </td>
                      <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50 text-slate-700 font-medium">
                        {row.lastUpdated}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50 text-center">
                        {row.notes ? (
                          <div
                            className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 mx-auto"
                            title={row.notes}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 mx-auto">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-200/60 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(row.id); }}
                          className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors mx-auto"
                          aria-label={expandedId === row.id ? "Collapse" : "Expand"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {expandedId === row.id
                              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            }
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {expandedId === row.id && (
                      <ExpandedPanel
                        row={row}
                        onCollapse={() => setExpandedId(null)}
                      />
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            total={filtered.length}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>

      </div>
    </MainLayout>
  );
}
