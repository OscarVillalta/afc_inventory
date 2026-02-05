import { useState } from "react";
import AirFiltersTable from "../components/inventory/AirFiltersTable";
import MiscItemsTable from "../components/inventory/MiscItemsTable";
import MainLayout from "../layouts/MainLayout";

export default function Inventory() {
  const [tab, setTab] = useState<"filters" | "misc" | "products" | "quantities">(
    "filters"
  );

  return (
    <MainLayout>
      <div className="p-6 w-full space-y-8">

        {/* PAGE HEADER */}
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
          <p className="text-gray-500 mt-1">
            View, analyze, and manage your filter and misc inventory.
          </p>
        </div>

        {/* TABS */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-fit p-2 flex gap-2">
          <button
            onClick={() => setTab("filters")}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === "filters"
                ? "bg-blue-100 text-blue-700 border border-blue-300 shadow-sm"
                : "text-gray-600 hover:bg-gray-100"}
            `}
          >
            Air Filters
          </button>

          <button
            onClick={() => setTab("misc")}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === "misc"
                ? "bg-blue-100 text-blue-700 border border-blue-300 shadow-sm"
                : "text-gray-600 hover:bg-gray-100"}
            `}
          >
            Misc Items
          </button>
        </div>

        {/* CONTENT */}
        <div className="mt-10">
          {tab === "filters" && <AirFiltersTable />}
          {tab === "misc" && <MiscItemsTable />}
        </div>

      </div>
    </MainLayout>
  );
}
