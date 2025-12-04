import MDTable from "../table/MDtable";
import { useState } from "react";

export default function AirFiltersTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Replace with real data later
  const total = 52;

  return (
    <MDTable
      title="Air Filters"
      columns={["Part Number", "Supplier", "Dimensions", "Category","Height","Width","Depth", "MERV", "Initial Resistance", "Final Resistance"]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
    >
      {/* Example row — replace with real data later */}
      <tr className="bg-white shadow-sm rounded-xl">
        <td className="py-3 px-2">FGP-12x24x2</td>
        <td className="py-3 px-2">13</td>
        <td className="py-3 px-2">12x24x2</td>
        <td className="py-3 px-2">Camfil</td>
      </tr>
    </MDTable>
  );
}
