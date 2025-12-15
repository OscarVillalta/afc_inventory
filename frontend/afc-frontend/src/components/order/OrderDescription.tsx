import React from "react";

export default function OrderDescription({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
      <div className="text-sm font-semibold text-gray-800">Description</div>

      <textarea
        className="textarea textarea-bordered w-full mt-3 min-h-[120px]"
        placeholder="Order description..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
