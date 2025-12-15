import React from "react";

type OrderStatus = "Pending" | "Partially Fulfilled" | "Completed";

export default function OrderHeader() {
  return (
    <div className="bg-slate-700 text-white px-6 py-3 flex justify-between items-center rounded-xl">
      <div>
        <h1 className="text-lg font-semibold tracking-widest">Order #100028</h1>
        <p className="text-sm">
          Customer Order • MediHealth • Pending
        </p>
      </div>

    </div>
  );
}

