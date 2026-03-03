import { useState, useMemo, useEffect, useCallback } from "react";
import React from "react";
import MainLayout from "../layouts/MainLayout";
import {
  fetchPackingSlips,
  updateOrderTracker,
  type PackingSlipResult,
  type Department,
  type OrderTrackerPayload,
  type OrderHistoryPayload,
} from "../api/tracker";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DEPT_STEPS: { dept: Department; label: string }[] = [
  { dept: "SALES", label: "Sales" },
  { dept: "LOGISTICS", label: "Logistics" },
  { dept: "DELIVERY_DEPT", label: "Delivery" },
  { dept: "SERVICE", label: "Service" },
  { dept: "ACCOUNTING", label: "Accounting" },
];

const LAST_STEP_INDEX = DEPT_STEPS.length - 1;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PackingSlipRow = {
  id: number;
  packingSlipNo: string;
  customer: string;
  type: string;
  status: string;         // order fulfillment status
  trackerStatus: string;  // derived from tracker step
  lastUpdated: string;
  notes?: string;
  tracker: OrderTrackerPayload | null;
  history: OrderHistoryPayload[];
};

type StepState = "completed" | "pending" | "not-started";

type Step = {
  key: string;
  label: string;
  dept: Department;
  index: number;
  timestamp: string;
  state: StepState;
};

// ─────────────────────────────────────────────
// Helper: convert API result → PackingSlipRow
// ─────────────────────────────────────────────

function toPackingSlipRow(r: PackingSlipResult): PackingSlipRow {
  const stepIndex = r.tracker?.step_index ?? -1;
  let trackerStatus: string;
  if (!r.tracker) {
    trackerStatus = "Not Started";
  } else if (stepIndex >= LAST_STEP_INDEX) {
    trackerStatus = "Completed";
  } else {
    trackerStatus = "In Progress";
  }

  const updated = r.tracker?.updated_at ?? r.created_at;
  const lastUpdated = updated ? new Date(updated).toLocaleDateString() : "";

  return {
    id: r.id,
    packingSlipNo: r.order_number,
    customer: r.customer_name ?? "—",
    type: r.order_type ?? "—",
    status: r.status,
    trackerStatus,
    lastUpdated,
    notes: r.description ?? undefined,
    tracker: r.tracker,
    history: r.history,
  };
}

// ─────────────────────────────────────────────
// Helper: build stepper steps from a row
// ─────────────────────────────────────────────

export function buildSteps(row: PackingSlipRow): Step[] {
  const currentIndex = row.tracker?.step_index ?? -1;

  return DEPT_STEPS.map((d, i) => {
    const histEntry = row.history
      .filter((h) => h.to_department === d.dept)
      .at(-1);

    let state: StepState;
    if (i < currentIndex) state = "completed";
    else if (i === currentIndex) state = "pending";
    else state = "not-started";

    const timestamp = histEntry?.completed_at
      ? new Date(histEntry.completed_at).toLocaleDateString()
      : "";

    return { key: d.dept, label: d.label, dept: d.dept, index: i, timestamp, state };
  });
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function TrackerStatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-base font-semibold ";
  let dotCls = "w-1.5 h-1.5 rounded-full shrink-0 ";
  if (s.includes("complet")) {
    cls += "bg-green-100 text-green-700";
    dotCls += "bg-green-500";
  } else if (s.includes("progress")) {
    cls += "bg-yellow-100 text-yellow-700";
    dotCls += "bg-yellow-500";
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
  let cls = "inline-flex items-center gap-2 rounded-lg px-3 py-1 text-base font-semibold ";
  if (t.includes("installation")) cls += "bg-blue-100 text-blue-700";
  else if (t.includes("delivery")) cls += "bg-teal-100 text-teal-700";
  else if (t.includes("shipment")) cls += "bg-cyan-100 text-cyan-700";
  else if (t.includes("will call")) cls += "bg-purple-100 text-purple-700";
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
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0">
      ○
    </div>
  );
}

function ProgressStepper({
  steps,
  onSetStep,
  saving,
}: {
  steps: Step[];
  onSetStep?: (dept: Department, index: number) => void;
  saving?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-start gap-0 min-w-max">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-start">
            {/* Step */}
            <div className="flex flex-col items-center w-32">
              <StepCircle state={step.state} />
              <span className="text-xs font-semibold text-gray-700 mt-1 text-center">
                {step.label}
              </span>
              <span className="text-xs text-gray-500 text-center mt-0.5">
                {step.state === "completed"
                  ? "Completed"
                  : step.state === "pending"
                  ? "In Progress"
                  : "Not Started"}
              </span>
              {step.timestamp && (
                <span className="text-xs text-gray-400 text-center">{step.timestamp}</span>
              )}
              {onSetStep && (
                <button
                  disabled={saving || step.state === "pending"}
                  onClick={() => onSetStep(step.dept, step.index)}
                  className={`mt-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    step.state === "pending"
                      ? "bg-yellow-100 text-yellow-600 cursor-default"
                      : step.state === "completed"
                      ? "bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  }`}
                  title={
                    step.state === "pending"
                      ? "Current step"
                      : step.state === "completed"
                      ? "Move back to this step"
                      : "Set as current step"
                  }
                >
                  {step.state === "pending"
                    ? "Current"
                    : step.state === "completed"
                    ? "↩ Redo"
                    : "→ Set"}
                </button>
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

type FilterTab = "All" | "Not Started" | "In Progress" | "Completed";

interface FilterBarProps {
  data: PackingSlipRow[];
  total: number;
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onCreateClick: () => void;
}

function FilterBar({
  data,
  total,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  onCreateClick,
}: FilterBarProps) {
  const counts = useMemo(
    () => ({
      All: total,
      "Not Started": data.filter((r) => r.trackerStatus === "Not Started").length,
      "In Progress": data.filter((r) => r.trackerStatus === "In Progress").length,
      Completed: data.filter((r) => r.trackerStatus === "Completed").length,
    }),
    [data, total]
  );

  const tabs: FilterTab[] = ["All", "Not Started", "In Progress", "Completed"];

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
              <span
                className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${
                  activeTab === tab
                    ? "bg-blue-200 text-blue-800"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {counts[tab as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>

        {/* Search + button */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search slip, customer…"
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

function ExpandedPanel({
  row,
  onCollapse,
  onRefresh,
}: {
  row: PackingSlipRow;
  onCollapse: () => void;
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const steps = buildSteps(row);
  const lastCompleted = [...steps].reverse().find((s) => s.state === "completed");

  const handleSetStep = async (dept: Department, index: number) => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateOrderTracker(row.id, {
        current_department: dept,
        step_index: index,
      });
      onRefresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update step.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td colSpan={8} className="p-0 border-b border-slate-200/60">
        <div className="bg-slate-50/60 mx-3 my-2 rounded-xl border border-slate-200/60 p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-base font-bold text-slate-900">{row.packingSlipNo}</span>
              <span className="mx-2 text-slate-400">·</span>
              <span className="text-base font-semibold text-slate-600">{row.customer}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                Progress
              </p>

              {/* Progress Stepper with step controls */}
              <ProgressStepper
                steps={steps}
                onSetStep={handleSetStep}
                saving={saving}
              />

              {saveError && (
                <p className="mt-2 text-xs text-red-600">{saveError}</p>
              )}

              {/* Footer info */}
              <div className="mt-4 flex flex-col sm:flex-row gap-4 text-sm text-slate-600">
                {lastCompleted && (
                  <div>
                    <span className="font-medium text-slate-700">Last completed: </span>
                    {lastCompleted.label}
                    {lastCompleted.timestamp ? ` on ${lastCompleted.timestamp}` : ""}
                  </div>
                )}
              </div>
            </div>

            {row.notes && (
              <div>
                <span className="font-medium text-slate-700 text-sm">Notes</span>
                <div className="mt-1 text-sm text-slate-600">{row.notes}</div>
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
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++)
      pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-200/70 text-sm">
      <span className="text-slate-500">
        {total === 0 ? "No results" : `${start}–${end} of ${total}`}
      </span>
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
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400">
              …
            </span>
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

function KpiCards({ data, total }: { data: PackingSlipRow[]; total: number }) {
  const notStarted = data.filter((r) => r.trackerStatus === "Not Started").length;
  const inProgress = data.filter((r) => r.trackerStatus === "In Progress").length;
  const completed = data.filter((r) => r.trackerStatus === "Completed").length;

  const cards = [
    { label: "Total Orders", value: total, color: "text-gray-800" },
    { label: "Not Started", value: notStarted, color: "text-slate-600" },
    { label: "In Progress", value: inProgress, color: "text-yellow-600" },
    { label: "Completed", value: completed, color: "text-green-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="stat bg-white rounded-xl shadow-sm border border-gray-100 p-4"
        >
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const [allRows, setAllRows] = useState<PackingSlipRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Debounce search to reduce API calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadData = useCallback(async (p: number, s: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const resp = await fetchPackingSlips({ page: p, limit: PAGE_SIZE, search: s });
      setAllRows(resp.results.map(toPackingSlipRow));
      setTotal(resp.total);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(page, debouncedSearch);
  }, [page, debouncedSearch, loadData]);

  // Reset page when search changes
  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  // Client-side filter by tracker status tab
  const filtered = useMemo(() => {
    if (activeTab === "All") return allRows;
    return allRows.filter((r) => r.trackerStatus === activeTab);
  }, [allRows, activeTab]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── Page Header ─────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Packing Slip Tracker</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Track shipment progress through each checkpoint
            </p>
          </div>
        </div>

        {/* ── Filter Bar ──────────────────────────── */}
        <FilterBar
          data={allRows}
          total={total}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          search={search}
          onSearchChange={handleSearch}
          onCreateClick={() => alert("Create Shipment — coming soon")}
        />

        {/* ── KPI Cards ───────────────────────────── */}
        <KpiCards data={allRows} total={total} />

        {/* ── Table Card ──────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-3 sm:p-4">

          {fetchError && (
            <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {/* Table scroll wrapper */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                <col className="w-36" />
                <col className="w-48" />
                <col className="w-36" />
                <col className="w-40" />
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
                    Order Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Tracker Status
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
                {loading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((row, rowIndex) => (
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpand(row.id);
                          }
                        }}
                      >
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                          <span className="font-semibold text-slate-900">{row.packingSlipNo}</span>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50 font-medium text-slate-800">
                          <span className="truncate block" title={row.customer}>
                            {row.customer}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                          <TypePill type={row.type} />
                        </td>
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50 text-slate-600 text-sm">
                          {row.status}
                        </td>
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                          <TrackerStatusPill status={row.trackerStatus} />
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
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(row.id);
                            }}
                            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors mx-auto"
                            aria-label={expandedId === row.id ? "Collapse" : "Expand"}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {expandedId === row.id ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              )}
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {expandedId === row.id && (
                        <ExpandedPanel
                          row={row}
                          onCollapse={() => setExpandedId(null)}
                          onRefresh={() => loadData(page, debouncedSearch)}
                        />
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>

      </div>
    </MainLayout>
  );
}
