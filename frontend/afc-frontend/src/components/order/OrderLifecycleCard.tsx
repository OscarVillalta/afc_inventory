import { useState } from "react";
import type { OrderWithTracking, Department } from "../../api/tracker";
import { patchOrderPaidInvoiced, initOrderTracker, updateOrderTracker } from "../../api/tracker";

// ─────────────────────────────────────────────
// 6-step lifecycle path
// ─────────────────────────────────────────────

const TRACKER_STEPS: { dept: Department; label: string }[] = [
  { dept: "SALES",         label: "Sales" },
  { dept: "LOGISTICS",     label: "Logistics" },
  { dept: "DELIVERY_DEPT", label: "Delivery" },
  { dept: "SERVICE",       label: "Service" },
  { dept: "SALES",         label: "Sales II" },
  { dept: "LOGISTICS",     label: "Logistics II" },
];

const LAST_STEP_INDEX = TRACKER_STEPS.length - 1;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StepState = "completed" | "active" | "pending";

interface Props {
  trackingData: OrderWithTracking | null;
  createdAt: string;
  status: string;
  isPaid: boolean;
  isInvoiced: boolean;
  orderId: number;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────
// Step icon
// ─────────────────────────────────────────────

function StepIcon({ state }: { state: StepState }) {
  if (state === "completed") {
    return (
      <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full border-2 border-blue-200 bg-blue-50" />
        {/* Blue circle outline */}
        <div className="absolute w-7 h-7 rounded-full border-2 border-blue-500 bg-white" />
        {/* Inner solid dot */}
        <div className="absolute w-3 h-3 rounded-full bg-blue-500" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full border-[3px] border-gray-300 bg-white shrink-0" />
  );
}

// ─────────────────────────────────────────────
// Custom checkbox
// ─────────────────────────────────────────────

function CustomCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`w-7 h-7 rounded-md flex items-center justify-center border-2 ${
          checked
            ? "bg-slate-700 border-slate-700"
            : "border-gray-400 bg-white"
        }`}
      >
        {checked && (
          <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <span className="text-base font-semibold text-gray-700">{label}</span>
    </label>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function OrderLifecycleCard({
  trackingData,
  createdAt,
  status,
  isPaid,
  isInvoiced,
  orderId,
  onRefresh,
}: Props) {
  const [paid, setPaid] = useState(isPaid);
  const [invoiced, setInvoiced] = useState(isInvoiced);
  const [saving, setSaving] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const tracker = trackingData?.tracker ?? null;
  const stepIndex = tracker?.step_index ?? -1;
  const history = trackingData?.history ?? [];
  const isCompleted = stepIndex >= LAST_STEP_INDEX;
  const nextStepIndex = stepIndex + 1;
  const nextStep = !isCompleted ? TRACKER_STEPS[nextStepIndex] : null;

  const steps = TRACKER_STEPS.map((step, i) => {
    let state: StepState;
    if (i < stepIndex) state = "completed";
    else if (i === stepIndex) state = "active";
    else state = "pending";

    const historyEntry = history[i];
    const timestamp = historyEntry?.completed_at
      ? new Date(historyEntry.completed_at).toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    return { ...step, number: i + 1, state, timestamp };
  });

  // Last updated at: use tracker updated_at, fall back to createdAt
  const lastUpdatedSource = tracker?.updated_at ?? createdAt;
  const lastUpdatedAt = lastUpdatedSource
    ? new Date(lastUpdatedSource).toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  async function handleAdvance() {
    if (!orderId) return;
    setSaving(true);
    setAdvanceError(null);
    try {
      if (!tracker) {
        await initOrderTracker(orderId, {
          current_department: TRACKER_STEPS[0].dept,
          step_index: 0,
        });
      } else if (nextStep) {
        await updateOrderTracker(orderId, {
          current_department: nextStep.dept,
          step_index: nextStepIndex,
        });
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to advance tracker:", err);
      setAdvanceError("Failed to update tracker. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePaidChange(checked: boolean) {
    setPaid(checked);
    try {
      await patchOrderPaidInvoiced(orderId, { is_paid: checked });
      onRefresh();
    } catch (err) {
      console.error("Failed to update paid status:", err);
      setPaid(!checked);
    }
  }

  async function handleInvoicedChange(checked: boolean) {
    setInvoiced(checked);
    try {
      await patchOrderPaidInvoiced(orderId, { is_invoiced: checked });
      onRefresh();
    } catch (err) {
      console.error("Failed to update invoiced status:", err);
      setInvoiced(!checked);
    }
  }

  const advanceLabel = saving
    ? "Saving…"
    : isCompleted
    ? "Completed"
    : !tracker
    ? "Start Tracking"
    : `Advance to ${nextStep!.label}`;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <h2 className="text-xl font-extrabold text-gray-900">Progress Tracker</h2>
        {isCompleted ? (
          <span className="text-sm font-semibold text-green-700 bg-green-100 border border-green-300 px-3 py-1 rounded-full">
            ✓ Tracking Complete
          </span>
        ) : (
          <button
            className="btn btn-sm btn-primary"
            onClick={handleAdvance}
            disabled={saving}
          >
            {advanceLabel}
          </button>
        )}
      </div>

      {advanceError && (
        <p className="text-sm text-red-500 mb-3">{advanceError}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* ── Column 1: Vertical lifecycle tracker ── */}
        <div>
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              {/* Icon + connector line */}
              <div className="flex flex-col items-center">
                <StepIcon state={step.state} />
                {i < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-8 mt-0.5 ${
                      step.state === "completed" ? "bg-green-400" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>

              {/* Step label */}
              <div className="pb-1 pt-0.5">
                <p
                  className={`text-sm font-bold leading-tight ${
                    step.state === "completed"
                      ? "text-green-700"
                      : step.state === "active"
                      ? "text-blue-700"
                      : "text-gray-500"
                  }`}
                >
                  {step.number}. {step.label}
                </p>
                <p
                  className={`text-xs font-medium mt-0.5 ${
                    step.state === "completed"
                      ? "text-green-600"
                      : step.state === "active"
                      ? "text-blue-600"
                      : "text-gray-400"
                  }`}
                >
                  {step.state === "completed"
                    ? "Completed"
                    : step.state === "active"
                    ? "Action Required"
                    : "Pending"}
                </p>
                {step.timestamp && (
                  <p className="text-xs text-gray-400 mt-0.5">{step.timestamp}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Column 2: Last updated at ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last updated at</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{lastUpdatedAt}</p>
        </div>

        {/* ── Column 3: Category & checkboxes ── */}
        <div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{status}</p>
          </div>

          <div className="mt-4 space-y-3">
            <CustomCheckbox
              checked={invoiced}
              onChange={handleInvoicedChange}
              label="Invoiced"
            />
            <CustomCheckbox
              checked={paid}
              onChange={handlePaidChange}
              label="Paid"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
