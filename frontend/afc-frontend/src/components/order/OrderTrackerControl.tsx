import { useState } from "react";
import type { OrderWithTracking, Department } from "../../api/tracker";
import { updateOrderTracker, initOrderTracker } from "../../api/tracker";

// ─────────────────────────────────────────────
// 6-step Installation lifecycle path
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

type StepState = "completed" | "pending" | "not-started";

interface Props {
  trackingData: OrderWithTracking | null;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────
// Step circle indicator
// ─────────────────────────────────────────────

function StepCircle({ state }: { state: StepState }) {
  if (state === "completed")
    return (
      <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs shrink-0">
        ✓
      </div>
    );
  if (state === "pending")
    return (
      <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs shrink-0 animate-pulse">
        ●
      </div>
    );
  return (
    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0">
      ○
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function OrderTrackerControl({ trackingData, onRefresh }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!trackingData) return null;

  const tracker = trackingData.tracker;
  const orderId = trackingData.order.id;
  const currentStepIndex = tracker?.step_index ?? -1;
  const isCompleted = currentStepIndex >= LAST_STEP_INDEX;
  const nextStepIndex = currentStepIndex + 1;
  const nextStep = !isCompleted ? TRACKER_STEPS[nextStepIndex] : null;

  // Build display steps with state
  const steps = TRACKER_STEPS.map((step, i) => {
    let state: StepState;
    if (i < currentStepIndex) state = "completed";
    else if (i === currentStepIndex) state = "pending";
    else state = "not-started";
    return { ...step, index: i, state };
  });

  async function handleAdvance() {
    if (!orderId) return;
    setSaving(true);
    setError(null);
    try {
      if (!tracker) {
        // No tracker yet — initialise at step 0
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
      setError("Failed to update tracker. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const advanceLabel = saving
    ? "Saving…"
    : isCompleted
    ? "Completed"
    : !tracker
    ? "Start Tracking"
    : `Advance to ${nextStep?.label ?? "Next Stage"}`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700">Order Tracker</h2>

        {isCompleted ? (
          <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
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

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* Step progression */}
      <div className="overflow-x-auto">
        <div className="flex items-start gap-0 min-w-max">
          {steps.map((step, i) => (
            <div key={`${step.dept}-${i}`} className="flex items-start">
              {/* Step column */}
              <div className="flex flex-col items-center w-24">
                <StepCircle state={step.state} />
                <span className="text-xs font-medium text-gray-700 mt-1 text-center leading-tight">
                  {step.label}
                </span>
                <span className="text-xs text-gray-400 text-center mt-0.5">
                  {step.state === "completed"
                    ? "Done"
                    : step.state === "pending"
                    ? "Active"
                    : "—"}
                </span>
              </div>
              {/* Connector */}
              {i < steps.length - 1 && (
                <div
                  className={`w-6 h-0.5 mt-3.5 shrink-0 ${
                    step.state === "completed" ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
