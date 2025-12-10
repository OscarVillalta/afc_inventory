import MDTable from "../table/MDtable";
import { useEffect, useState } from "react";
import { fetchAirFilters } from "../../api/airfilters"
import type { AirFilterPayload } from "../../api/airfilters";

export default function AirFiltersTable() {
  const [filters, setFilters] = useState<AirFilterPayload[]>([]);
  const [page, setPage] = useState(1);
 

  useEffect(() => {
    fetchAirFilters(page, 25).then((data) => {
      setFilters(data.results); // assuming backend returns { items, total }
      console.log(data)
    });
  }, [page]);

  return (
    <MDTable
      title="Air Filters"
      columns={[
        "Part Number",
        "Supplier",
        "Category",
        "Height",
        "Width",
        "Depth",
        "merv",
        "Initial Resistance",
        "Final Resistance"
      ]}
      page={page}
      pageSize={25}
      total={100}
      onPageChange={setPage}
    >
      {filters.map((f) => (
        <tr
          key={f.id}
          className="
            bg-white 
            border border-gray-200 
            rounded-lg 
            hover:bg-gray-50 
            transition 
            text-sm
          "
        >
          <td className="py-3 px-3 font-medium">{f.part_number}</td>
          <td className="py-3 px-3">{f.supplier}</td>

          {/* CATEGORY BADGE */}
          <td className="py-3 px-3">
            <span className="badge bg-blue-100 text-blue-700 border-blue-200">
              {f.category}
            </span>
          </td>

          <td className="py-3 px-3">{f.height}</td>
          <td className="py-3 px-3">{f.width}</td>
          <td className="py-3 px-3">{f.depth}</td>

          <td className="py-3 px-3 font-semibold text-gray-800">{f.merv}</td>

          <td className="py-3 px-3 text-gray-600">{f.initial_resistance}</td>
          <td className="py-3 px-3 text-gray-600">{f.final_resistance}</td>
        </tr>
      ))}
    </MDTable>
  );
}
