import { useState } from "react";
import AirFiltersTable from "../components/inventory/AirFiltersTable";
import MiscItemsTable from "../components/inventory/MiscItemsTable";
import ProductsTable from "../components/inventory/ProductsTable";
import QuantitiesTable from "../components/inventory/QuantitiesTable";
import MainLayout from "../layouts/MainLayout";

export default function Inventory() {
  const [tab, setTab] = useState<"filters" | "misc" | "products" | "quantities">(
    "filters"
  );

  return (
    <MainLayout>
      <div className="p-6 w-full">
      {/* Page Title */}
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Inventory Management
      </h1>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-boxed bg-base-200 p-1 w-fit mb-6 shadow-sm">
        <a
          role="tab"
          className={`tab ${tab === "filters" ? "tab-active" : ""}`}
          onClick={() => setTab("filters")}
        >
          Air Filters
        </a>
        <a
          role="tab"
          className={`tab ${tab === "misc" ? "tab-active" : ""}`}
          onClick={() => setTab("misc")}
        >
          Misc Items
        </a>
      </div>

      {/* Content Switch */}
      <div className="mt-10">
        {tab === "filters" && <AirFiltersTable />}
        {tab === "misc" && <MiscItemsTable />}
      </div>
    </div>
    </MainLayout>
  );
}
