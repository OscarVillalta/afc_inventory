import MDTable from "../table/MDtable";
import { useState } from "react";

export default function AirFiltersTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const total = 52;

  const rows = [
    {
      part: "FGP-12x24x2",
      supplier: "Camfil",
      dims: "12 × 24 × 2",
      category: "Box Filter",
      height: 12,
      width: 24,
      depth: 2,
      merv: 13,
      initRes: "0.25 in w.g.",
      finalRes: "1.0 in w.g."
    },
        {
      part: "FGP-12x24x2",
      supplier: "Camfil",
      dims: "12 × 24 × 2",
      category: "Box Filter",
      height: 12,
      width: 24,
      depth: 2,
      merv: 13,
      initRes: "0.25 in w.g.",
      finalRes: "1.0 in w.g."
    }
  ];

  return (
    <MDTable
      title="Air Filters"
      columns={[
        "Part Number",
        "Supplier",
        "Dimensions",
        "Category",
        "Height",
        "Width",
        "Depth",
        "MERV",
        "Initial Resistance",
        "Final Resistance"
      ]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
    >
      {rows.map((r, i) => (
        <tr
          key={i}
          className="
            bg-white 
            border border-gray-200 
            rounded-lg 
            hover:bg-gray-50 
            transition 
            text-sm
          "
        >
          <td className="py-3 px-3 font-medium">{r.part}</td>
          <td className="py-3 px-3">{r.supplier}</td>
          <td className="py-3 px-3 text-gray-700">{r.dims}</td>

          {/* CATEGORY BADGE */}
          <td className="py-3 px-3">
            <span className="badge bg-blue-100 text-blue-700 border-blue-200">
              {r.category}
            </span>
          </td>

          <td className="py-3 px-3">{r.height}</td>
          <td className="py-3 px-3">{r.width}</td>
          <td className="py-3 px-3">{r.depth}</td>

          <td className="py-3 px-3 font-semibold text-gray-800">{r.merv}</td>

          <td className="py-3 px-3 text-gray-600">{r.initRes}</td>
          <td className="py-3 px-3 text-gray-600">{r.finalRes}</td>
        </tr>
      ))}
    </MDTable>
  );
}
