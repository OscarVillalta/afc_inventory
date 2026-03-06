import { useState } from "react";
import type { OrderWithTracking, Department, OrderTrackerStagePayload } from "../../api/tracker";
import { toggleTrackerStage, initOrderTracker } from "../../api/tracker";

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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Props {
  trackingData: OrderWithTracking | null;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────
// Step circle indicator (clickable)
// ─────────────────────────────────────────────

function StepCircle({
  isCompleted,
  saving,
  onClick,
}: {
  isCompleted: boolean;
  saving: boolean;
  onClick: () => void;
}) {
  const base = "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0 transition-all cursor-pointer select-none";
  if (saving)
    return (
      <div className={`${base} bg-gray-300 animate-pulse`} title="Saving…">
        ◌
      </div>
    );
  if (isCompleted)
    return (
      <div
        className={`${base} bg-green-500 hover:bg-green-600 shadow-sm`}
        onClick={onClick}
        title="Click to mark incomplete"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      >
        ✓
      </div>
    );
  return (
    <div
      className={`${base} bg-gray-200 hover:bg-blue-400 hover:text-white text-gray-400`}
      onClick={onClick}
      title="Click to mark complete"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
    >
      ○
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function OrderTrackerControl({ trackingData, onRefresh }: Props) {
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!trackingData) return null;

  const orderId = trackingData.order.id;
  const stages = trackingData.stages ?? [];

  // Build a lookup map: stage_index → stage record
  const stageMap = new Map<number, OrderTrackerStagePayload>(
    stages.map((s) => [s.stage_index, s])
  );

  const allCompleted = TRACKER_STEPS.every((_, i) => stageMap.get(i)?.is_completed);

  async function handleToggle(index: number) {
    if (!orderId || savingIndex !== null) return;
    setSavingIndex(index);
    setError(null);
    try {
      const currentStage = stageMap.get(index);
      const newCompleted = !(currentStage?.is_completed ?? false);

      // Ensure tracker exists before toggling stages
      if (!trackingData!.tracker) {
        await initOrderTracker(orderId, {
          current_department: TRACKER_STEPS[0].dept,
          step_index: 0,
        });
      }

      await toggleTrackerStage(orderId, index, { is_completed: newCompleted });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle stage:", err);
      setError("Failed to update stage. Please try again.");
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700">Order Tracker</h2>
        {allCompleted && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
            ✓ Tracking Complete
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* Step progression */}
      <div className="overflow-x-auto">
        <div className="flex items-start gap-0 min-w-max">
          {TRACKER_STEPS.map((step, i) => {
            const stage = stageMap.get(i);
            const isCompleted = stage?.is_completed ?? false;
            const saving = savingIndex === i;

            const timestamp = stage?.completed_at
              ? new Date(stage.completed_at).toLocaleString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit",
                })
              : null;

            return (
              <div key={`${step.dept}-${i}`} className="flex items-start">
                {/* Step column */}
                <div className="flex flex-col items-center w-28">
                  <StepCircle
                    isCompleted={isCompleted}
                    saving={saving}
                    onClick={() => handleToggle(i)}
                  />
                  <span className="text-xs font-medium text-gray-700 mt-1 text-center leading-tight">
                    {step.label}
                  </span>
                  {timestamp && (
                    <span className="text-xs text-gray-400 text-center mt-0.5 leading-tight">
                      {timestamp}
                    </span>
                  )}
                  {stage?.completed_by && (
                    <span className="text-xs text-blue-500 text-center mt-0.5 italic leading-tight">
                      by {stage.completed_by}
                    </span>
                  )}
                </div>
                {/* Connector */}
                {i < TRACKER_STEPS.length - 1 && (
                  <div
                    className={`w-6 h-0.5 mt-3.5 shrink-0 ${
                      isCompleted ? "bg-green-400" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
