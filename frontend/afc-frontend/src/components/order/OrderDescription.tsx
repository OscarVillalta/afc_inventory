import React from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  selectedItemsCount: number;
  onAllocateSelected: () => void;
  onCommitSelected: () => void;
  onCancelSelected: () => void;
  onRollbackSelected: () => void;
  disabled?: boolean;
}

export default function OrderDescription({ 
  value, 
  onChange, 
  selectedItemsCount,
  onAllocateSelected,
  onCommitSelected,
  onCancelSelected,
  onRollbackSelected,
  disabled = false,
}: Props) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
      <div className="text-sm font-semibold text-gray-800">
        Description
      </div>

      <textarea
        className="textarea textarea-bordered w-full mt-3 min-h-[120px]"
        placeholder="Order description..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {selectedItemsCount > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs font-semibold text-blue-800 mb-2">
            Bulk Actions ({selectedItemsCount} selected)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-xs btn-primary"
              onClick={onAllocateSelected}
              disabled={disabled}
            >
              Allocate Selected
            </button>
            <button
              className="btn btn-xs btn-success"
              onClick={onCommitSelected}
              disabled={disabled}
            >
              Commit Selected
            </button>
            <button
              className="btn btn-xs btn-error"
              onClick={onCancelSelected}
              disabled={disabled}
            >
              Cancel Selected
            </button>
            <button
              className="btn btn-xs btn-warning"
              onClick={onRollbackSelected}
              disabled={disabled}
            >
              Rollback Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
