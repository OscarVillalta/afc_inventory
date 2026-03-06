import { useState, useEffect, useCallback } from "react";
import React from "react";
import { Link } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import {
  fetchPackingSlips,
  toggleTrackerStage,
  initOrderTracker,
  patchOrderPaidInvoiced,
  type PackingSlipResult,
  type Department,
  type OrderTrackerPayload,
  type OrderHistoryPayload,
  type OrderTrackerStagePayload,
} from "../api/tracker";
import { ORDER_TYPE_LABELS } from "../constants/orderTypes";

// ─────────────────────────────────────────────
// Tracker step-path definitions (one per order type group)
// ─────────────────────────────────────────────

/** 6-step path used exclusively for Installation orders. */
const INSTALLATION_STEPS: { dept: Department; label: string; occurrence: number }[] = [
  { dept: "SALES",         label: "Sales",         occurrence: 0 },
  { dept: "LOGISTICS",     label: "Logistics",     occurrence: 0 },
  { dept: "DELIVERY_DEPT", label: "Delivery",      occurrence: 0 },
  { dept: "SERVICE",       label: "Service",       occurrence: 0 },
  { dept: "SALES",         label: "Sales II",      occurrence: 1 },
  { dept: "LOGISTICS",     label: "Logistics II",  occurrence: 1 },
];

/** 4-step path used for Will Call, Delivery, and Shipment orders. */
const WILL_CALL_STEPS: { dept: Department; label: string }[] = [
  { dept: "SALES",         label: "Sales" },
  { dept: "LOGISTICS",     label: "Logistics" },
  { dept: "DELIVERY_DEPT", label: "Delivery" },
  { dept: "LOGISTICS",     label: "Logistics II" },
];

/** 3-step path used for Purchase Order (incoming) orders. */
const PURCHASE_ORDER_STEPS: { dept: Department; label: string }[] = [
  { dept: "LOGISTICS",     label: "Logistics" },
  { dept: "DELIVERY_DEPT", label: "Delivery" },
  { dept: "LOGISTICS",     label: "Logistics II" },
];

/** Returns the correct step template for the given order type string. */
function getStepsTemplate(orderType: string): { dept: Department; label: string }[] {
  const t = orderType?.toLowerCase();
  if (t === "installation") return INSTALLATION_STEPS;
  if (t === "incoming") return PURCHASE_ORDER_STEPS;
  return WILL_CALL_STEPS; // will_call, delivery, shipment
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PackingSlipRow = {
  id: number;
  packingSlipNo: string;
  customer: string;
  type: string;
  status: string;                    // order fulfillment status (Pending / Partially Fulfilled / Completed)
  stockState: string;                // "Reserved" | "Delivered"
  trackerStatus: string;             // derived from tracker step
  trackerDept: string;               // current department label for "IN X" badge
  lastUpdated: string;
  externalOrderNumber?: string | null;
  notes?: string;
  is_paid: boolean;
  is_invoiced: boolean;
  tracker: OrderTrackerPayload | null;
  history: OrderHistoryPayload[];
  stages: OrderTrackerStagePayload[];
};

type Step = {
  key: string;
  label: string;
  dept: Department;
  index: number;
  timestamp: string;
  performedBy: string;
  isCompleted: boolean;
};

// ─────────────────────────────────────────────
// Helper: dept → human label
// ─────────────────────────────────────────────

function deptLabel(dept: string): string {
  switch (dept) {
    case "SALES": return "Sales";
    case "LOGISTICS": return "Logistics";
    case "DELIVERY_DEPT": return "Delivery";
    case "SERVICE": return "Service";
    case "ACCOUNTING": return "Accounting";
    default: return dept;
  }
}

// ─────────────────────────────────────────────
// Helper: find the most recently completed stage
// ─────────────────────────────────────────────

function latestCompletedStage(stages: OrderTrackerStagePayload[]): OrderTrackerStagePayload | undefined {
  return stages
    .filter((s) => s.is_completed && s.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];
}

// ─────────────────────────────────────────────
// Helper: convert API result → PackingSlipRow
// ─────────────────────────────────────────────

function toPackingSlipRow(r: PackingSlipResult): PackingSlipRow {
  const stepsTemplate = getStepsTemplate(r.order_type ?? "");
  const totalSteps = stepsTemplate.length;
  const stages = r.stages ?? [];
  const completedCount = stages.filter((s) => s.is_completed).length;

  let trackerStatus: string;
  let trackerDept: string;
  if (completedCount === 0 && !r.tracker) {
    trackerStatus = "Not Started";
    trackerDept = "";
  } else if (completedCount >= totalSteps) {
    trackerStatus = "Completed";
    trackerDept = "";
  } else if (completedCount > 0 || r.tracker) {
    trackerStatus = "In Progress";
    trackerDept = r.tracker?.current_department
      ? `IN ${deptLabel(r.tracker.current_department).toUpperCase()}`
      : "IN PROGRESS";
  } else {
    trackerStatus = "Not Started";
    trackerDept = "";
  }

  // Physical stock state
  const stockState = r.status === "Completed" ? "Delivered" : "Reserved";

  // Use the most recent completed_at from stages, falling back to tracker updated_at
  const latestStage = latestCompletedStage(stages);
  const updated = latestStage?.completed_at ?? r.tracker?.updated_at ?? r.created_at;
  const lastUpdated = updated ? new Date(updated).toLocaleDateString() : "";

  return {
    id: r.id,
    packingSlipNo: r.order_number,
    customer: r.customer_name ?? "—",
    type: r.order_type ?? "—",
    status: r.status,
    stockState,
    trackerStatus,
    trackerDept,
    lastUpdated,
    externalOrderNumber: r.external_order_number ?? null,
    notes: r.description ?? undefined,
    is_paid: r.is_paid ?? false,
    is_invoiced: r.is_invoiced ?? false,
    tracker: r.tracker,
    history: r.history,
    stages,
  };
}

// ─────────────────────────────────────────────
// Helper: build stepper steps from a row
// ─────────────────────────────────────────────

export function buildSteps(row: PackingSlipRow): Step[] {
  const stepsTemplate = getStepsTemplate(row.type ?? "");
  const isInstallation = row.type?.toLowerCase() === "installation";

  // Build a map from stage_index → stage record
  const stageMap = new Map<number, OrderTrackerStagePayload>(
    (row.stages ?? []).map((s) => [s.stage_index, s])
  );

  return stepsTemplate.map((d, i) => {
    const wantedOccurrence = isInstallation
      ? (d as typeof INSTALLATION_STEPS[0]).occurrence
      : 0;

    const stage = stageMap.get(i);
    const isCompleted = stage?.is_completed ?? false;

    const timestamp = stage?.completed_at
      ? new Date(stage.completed_at).toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      : "";
    const performedBy = stage?.completed_by ?? "";

    return {
      key: `${d.dept}-${wantedOccurrence}-${i}`,
      label: d.label,
      dept: d.dept,
      index: i,
      timestamp,
      performedBy,
      isCompleted,
    };
  });
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StockStateBadge({ state }: { state: string }) {
  if (state === "Delivered") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-green-600 text-white">
        ✓ Delivered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700">
      ◆ Reserved
    </span>
  );
}

function TrackerStatusBadge({ status, deptLabel: dept }: { status: string; deptLabel: string }) {
  if (status === "Completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold bg-green-100 text-green-700 uppercase tracking-wide">
        ✓ COMPLETED
      </span>
    );
  }
  if (status === "In Progress" && dept) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold bg-yellow-100 text-yellow-700 uppercase tracking-wide">
        ● {dept}
      </span>
    );
  }
  if (status === "Not Started") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-500 uppercase tracking-wide">
        ○ NOT STARTED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-500 uppercase tracking-wide">
      ● {status}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const t = type.toLowerCase();
  let cls = "inline-flex items-center gap-2 rounded-lg px-3 py-1 text-base font-semibold ";
  if (t.includes("installation")) cls += "bg-blue-100 text-blue-700";
  else if (t.includes("delivery")) cls += "bg-teal-100 text-teal-700";
  else if (t.includes("shipment")) cls += "bg-cyan-100 text-cyan-700";
  else if (t.includes("will_call") || t.includes("will call")) cls += "bg-purple-100 text-purple-700";
  else if (t === "incoming") cls += "bg-orange-100 text-orange-700";
  else cls += "bg-slate-100 text-slate-600";

  // Display "Purchase Order" for incoming orders; use canonical label otherwise
  let displayLabel: string;
  if (t === "incoming") {
    displayLabel = "Purchase Order";
  } else {
    displayLabel = ORDER_TYPE_LABELS[t as keyof typeof ORDER_TYPE_LABELS] ?? type;
  }

  return (
    <span className={cls}>
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
      </svg>
      {displayLabel}
    </span>
  );
}

function StepCircle({
  isCompleted,
  saving,
  onClick,
}: {
  isCompleted: boolean;
  saving?: boolean;
  onClick?: () => void;
}) {
  const base = "w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 transition-all";
  const interactive = onClick ? "cursor-pointer select-none" : "";

  if (saving)
    return (
      <div className={`${base} bg-gray-300 animate-pulse text-white`} title="Saving…">
        ◌
      </div>
    );
  if (isCompleted)
    return (
      <div
        className={`${base} ${interactive} bg-green-500 hover:bg-green-600 text-white shadow-sm`}
        onClick={onClick}
        title={onClick ? "Click to mark incomplete" : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      >
        ✓
      </div>
    );
  return (
    <div
      className={`${base} ${interactive} bg-gray-200 hover:bg-blue-400 hover:text-white text-gray-400`}
      onClick={onClick}
      title={onClick ? "Click to mark complete" : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      ○
    </div>
  );
}

function ProgressStepper({
  steps,
  onToggleStep,
  savingIndex,
}: {
  steps: Step[];
  onToggleStep?: (index: number) => void;
  savingIndex?: number | null;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-start gap-0 min-w-max">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-start">
            {/* Step */}
            <div className="flex flex-col items-center w-32">
              <StepCircle
                isCompleted={step.isCompleted}
                saving={savingIndex === step.index}
                onClick={onToggleStep ? () => onToggleStep(step.index) : undefined}
              />
              <span className="text-xs font-semibold text-gray-700 mt-1 text-center">
                {step.label}
              </span>
              <span className="text-xs text-gray-500 text-center mt-0.5">
                {step.isCompleted ? "Completed" : "Not Started"}
              </span>
              {step.timestamp && (
                <span className="text-xs text-gray-400 text-center mt-0.5">{step.timestamp}</span>
              )}
              {step.performedBy && (
                <span className="text-xs text-blue-500 text-center mt-0.5 italic">
                  by {step.performedBy}
                </span>
              )}
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mt-4 shrink-0 ${
                  step.isCompleted ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PaidInvoicedToggle
// ─────────────────────────────────────────────

function PaidInvoicedToggle({
  orderId,
  isPaid,
  isInvoiced,
  onUpdate,
}: {
  orderId: number;
  isPaid: boolean;
  isInvoiced: boolean;
  onUpdate: (field: "is_paid" | "is_invoiced", value: boolean) => void;
}) {
  const [savingPaid, setSavingPaid] = useState(false);
  const [savingInvoiced, setSavingInvoiced] = useState(false);

  const toggle = async (field: "is_paid" | "is_invoiced", current: boolean) => {
    const setter = field === "is_paid" ? setSavingPaid : setSavingInvoiced;
    setter(true);
    try {
      await patchOrderPaidInvoiced(orderId, { [field]: !current });
      onUpdate(field, !current);
    } finally {
      setter(false);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        disabled={savingPaid}
        onClick={() => toggle("is_paid", isPaid)}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
          isPaid
            ? "bg-green-500 text-white border-green-500 shadow-sm"
            : "bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 hover:border-green-400"
        }`}
      >
        {savingPaid ? "…" : isPaid ? "✓ PAID" : "PAID"}
      </button>
      <button
        disabled={savingInvoiced}
        onClick={() => toggle("is_invoiced", isInvoiced)}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
          isInvoiced
            ? "bg-green-500 text-white border-green-500 shadow-sm"
            : "bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 hover:border-green-400"
        }`}
      >
        {savingInvoiced ? "…" : isInvoiced ? "✓ INVOICED" : "INVOICED"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

type FilterTab = "All" | "Not Started" | "In Progress" | "Completed";

// ─────────────────────────────────────────────
// Expanded Detail Panel
// ─────────────────────────────────────────────

function ExpandedPanel({
  row,
  onStagesUpdate,
  onPaidInvoicedUpdate,
}: {
  row: PackingSlipRow;
  onStagesUpdate: (orderId: number, updatedStage: OrderTrackerStagePayload) => void;
  onPaidInvoicedUpdate: (orderId: number, field: "is_paid" | "is_invoiced", value: boolean) => void;
}) {
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const steps = buildSteps(row);

  const handleToggleStep = async (index: number) => {
    setSavingIndex(index);
    setSaveError(null);
    try {
      // Ensure tracker exists
      if (!row.tracker) {
        const template = getStepsTemplate(row.type ?? "");
        const firstDept = template[0].dept;
        await initOrderTracker(row.id, {
          current_department: firstDept,
          step_index: 0,
        });
      }

      const currentStage = (row.stages ?? []).find((s) => s.stage_index === index);
      const newCompleted = !(currentStage?.is_completed ?? false);
      const updated = await toggleTrackerStage(row.id, index, { is_completed: newCompleted });
      onStagesUpdate(row.id, updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update step.");
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <tr>
      <td colSpan={8} className="p-0 border-b border-slate-200/60">
        <div className="bg-slate-50/60 mx-3 my-2 rounded-xl border border-slate-200/60 p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/orders/${row.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-base font-bold text-blue-700 hover:underline"
              >
                {row.packingSlipNo}
              </Link>
              <span className="text-slate-400">·</span>
              <span className="text-base font-semibold text-slate-600">{row.customer}</span>
              {row.externalOrderNumber && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Ext #</span>
                  <Link
                    to={`/orders/${row.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-semibold text-blue-700 hover:underline"
                  >
                    {row.externalOrderNumber}
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Three-column layout */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Left Section: Financials ── */}
            <div className="lg:w-48 shrink-0 flex flex-col gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                  Financials
                </p>
                <PaidInvoicedToggle
                  orderId={row.id}
                  isPaid={row.is_paid}
                  isInvoiced={row.is_invoiced}
                  onUpdate={(field, value) => onPaidInvoicedUpdate(row.id, field, value)}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px bg-slate-200 shrink-0" />

            {/* ── Middle Section: Progress Tracker ── */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                {row.type?.toLowerCase() === "installation"
                  ? "6-Step Installation Path"
                  : row.type?.toLowerCase() === "incoming"
                  ? "3-Step Purchase Order Path"
                  : "4-Step Progress"}
              </p>

              <ProgressStepper
                steps={steps}
                onToggleStep={handleToggleStep}
                savingIndex={savingIndex}
              />

              {saveError && (
                <p className="mt-2 text-xs text-red-600">{saveError}</p>
              )}
            </div>

            {/* ── Right Section: Description/Notes ── */}
            {row.notes && (
              <>
                <div className="hidden lg:block w-px bg-slate-200 shrink-0" />
                <div className="lg:w-56 shrink-0">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-slate-600 break-words leading-relaxed">
                    {row.notes}
                  </p>
                </div>
              </>
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

function KpiCards({
  total,
  statusCounts,
}: {
  total: number;
  statusCounts: { "Not Started": number; "In Progress": number; Completed: number };
}) {
  const cards = [
    { label: "Total Orders", value: total, color: "text-gray-800" },
    { label: "Not Started", value: statusCounts["Not Started"], color: "text-slate-600" },
    { label: "In Progress", value: statusCounts["In Progress"], color: "text-yellow-600" },
    { label: "Completed", value: statusCounts["Completed"], color: "text-green-600" },
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

const DEFAULT_STATUS_COUNTS = { "Not Started": 0, "In Progress": 0, Completed: 0 };

export default function PackingSlipTrackerPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<PackingSlipRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState(DEFAULT_STATUS_COUNTS);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* ── Additional filter state ── */
  const [filterOrderType, setFilterOrderType] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStockState, setFilterStockState] = useState("");

  // Debounce search to reduce API calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadData = useCallback(async (p: number, s: string, tab: FilterTab) => {
    setLoading(true);
    setFetchError(null);
    try {
      const resp = await fetchPackingSlips({
        page: p,
        limit: PAGE_SIZE,
        search: s,
        tracker_status: tab === "All" ? undefined : tab,
      });
      setRows(resp.results.map(toPackingSlipRow));
      setTotal(resp.total);
      setStatusCounts(resp.status_counts);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(page, debouncedSearch, activeTab);
  }, [page, debouncedSearch, activeTab, loadData]);

  // Reset page when search or tab changes
  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  // Optimistic update: update a stage in local state without a full reload
  const handleStagesUpdate = useCallback((orderId: number, updatedStage: OrderTrackerStagePayload) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== orderId) return row;

        // Update the stages array
        const existingIndex = row.stages.findIndex((s) => s.stage_index === updatedStage.stage_index);
        const newStages = existingIndex >= 0
          ? row.stages.map((s) => s.stage_index === updatedStage.stage_index ? updatedStage : s)
          : [...row.stages, updatedStage];

        const totalSteps = getStepsTemplate(row.type ?? "").length;
        const completedCount = newStages.filter((s) => s.is_completed).length;

        let trackerStatus: string;
        let trackerDept: string;
        if (completedCount === 0 && !row.tracker) {
          trackerStatus = "Not Started";
          trackerDept = "";
        } else if (completedCount >= totalSteps) {
          trackerStatus = "Completed";
          trackerDept = "";
        } else {
          trackerStatus = "In Progress";
          trackerDept = row.tracker?.current_department
            ? `IN ${deptLabel(row.tracker.current_department).toUpperCase()}`
            : "IN PROGRESS";
        }

        const latest = latestCompletedStage(newStages);
        const lastUpdated = latest?.completed_at
          ? new Date(latest.completed_at).toLocaleDateString()
          : row.lastUpdated;

        return {
          ...row,
          stages: newStages,
          trackerStatus,
          trackerDept,
          lastUpdated,
        };
      })
    );
  }, []);

  // Optimistic update for paid/invoiced toggles
  const handlePaidInvoicedUpdate = useCallback(
    (orderId: number, field: "is_paid" | "is_invoiced", value: boolean) => {
      setRows((prev) =>
        prev.map((row) =>
          row.id === orderId ? { ...row, [field]: value } : row
        )
      );
    },
    []
  );

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const allCount = (statusCounts["Not Started"] ?? 0) +
    (statusCounts["In Progress"] ?? 0) +
    (statusCounts["Completed"] ?? 0);

  /* ── Client-side filtering on top of paginated results ── */
  const filteredRows = rows.filter((row) => {
    if (filterOrderType && row.type.toLowerCase() !== filterOrderType.toLowerCase()) return false;
    if (filterDepartment && row.tracker?.current_department !== filterDepartment) return false;
    if (filterStockState && row.stockState !== filterStockState) return false;
    return true;
  });

  const hasActiveFilters =
    filterOrderType !== "" || filterDepartment !== "" || filterStockState !== "" || search !== "";

  const handleClearFilters = () => {
    setFilterOrderType("");
    setFilterDepartment("");
    setFilterStockState("");
    setSearch("");
    setPage(1);
  };

  const STATUS_TABS: FilterTab[] = ["All", "Not Started", "In Progress", "Completed"];
  const statusTabCounts: Record<FilterTab, number> = {
    All: allCount,
    "Not Started": statusCounts["Not Started"] ?? 0,
    "In Progress": statusCounts["In Progress"] ?? 0,
    Completed: statusCounts["Completed"] ?? 0,
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

        {/* ── Global Filter Bar (Inventory.tsx style) ─── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">

          {/* Search */}
          <div className="flex flex-col gap-0.5 min-w-[160px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Search</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Slip #, customer…"
                className="border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
              />
            </div>
          </div>

          {/* Order Type */}
          <div className="flex flex-col gap-0.5 min-w-[140px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Order Type</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filterOrderType}
              onChange={(e) => { setFilterOrderType(e.target.value); setPage(1); }}
            >
              <option value="">All Types</option>
              <option value="Installation">Installation</option>
              <option value="Delivery">Delivery</option>
              <option value="Shipment">Shipment</option>
              <option value="Will Call">Will Call</option>
              <option value="incoming">Purchase Order</option>
            </select>
          </div>

          {/* Department */}
          <div className="flex flex-col gap-0.5 min-w-[140px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Department</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filterDepartment}
              onChange={(e) => { setFilterDepartment(e.target.value); setPage(1); }}
            >
              <option value="">All Departments</option>
              <option value="SALES">Sales</option>
              <option value="LOGISTICS">Logistics</option>
              <option value="DELIVERY_DEPT">Delivery</option>
              <option value="SERVICE">Service</option>
              <option value="ACCOUNTING">Accounting</option>
            </select>
          </div>

          {/* Stock State */}
          <div className="flex flex-col gap-0.5 min-w-[140px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Stock State</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filterStockState}
              onChange={(e) => { setFilterStockState(e.target.value); setPage(1); }}
            >
              <option value="">All States</option>
              <option value="Reserved">Reserved</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>

          {/* Clear All */}
          <div className="flex items-center ml-auto">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* ── Quick-Filter Status Pills ──────────────── */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                activeTab === tab
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}{" "}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === tab
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {statusTabCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* ── KPI Cards ───────────────────────────── */}
        <KpiCards total={allCount} statusCounts={statusCounts} />

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
                <col className="w-44" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-40" />
                <col className="w-36" />
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
                    External Order #
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Stock State
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

                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRows.map((row, rowIndex) => (
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
                          <Link
                            to={`/orders/${row.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-blue-700 hover:underline"
                          >
                            {row.packingSlipNo}
                          </Link>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50 font-medium text-slate-800">
                          <span className="truncate block" title={row.customer}>
                            {row.customer}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                          <TypePill type={row.type} />
                        </td>
                        {/* External Order # */}
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                          {row.externalOrderNumber ? (
                            <Link
                              to={`/orders/${row.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-blue-700 hover:underline text-sm"
                            >
                              {row.externalOrderNumber}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        {/* Stock State */}
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                          <StockStateBadge state={row.stockState} />
                        </td>
                        {/* Tracker Status */}
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50">
                          <TrackerStatusBadge
                            status={row.trackerStatus}
                            deptLabel={row.trackerDept}
                          />
                        </td>
                        <td className="px-4 py-3 border-b border-slate-200/60 border-r border-slate-200/50 text-slate-700 font-medium">
                          {row.lastUpdated}
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
                          onStagesUpdate={handleStagesUpdate}
                          onPaidInvoicedUpdate={handlePaidInvoicedUpdate}
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
