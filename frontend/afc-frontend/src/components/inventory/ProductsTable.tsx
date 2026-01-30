import { useState } from "react";
import MDTable from "../table/MDtable";

export default function ProductsTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // TEMP DATA — replace with API results later
  const rows = [
    {
      id: 1,
      type: "Filter",
      identifier: "FGP-12x24x2",
      category: "Box Filter",
      active: true,
    },
  ];

  const total = rows.length;

  return (
    <MDTable
      title="Product Catalog"
      columns={["ID", "Type", "Identifier", "Category", "Active"]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
    >
      {rows.map((row) => (
        <tr key={row.id} className="bg-white shadow-sm rounded-xl">
          <td className="py-3 px-2">{row.id}</td>
          <td className="py-3 px-2">{row.type}</td>
          <td className="py-3 px-2">{row.identifier}</td>
          <td className="py-3 px-2">{row.category}</td>
          <td className="py-3 px-2">{row.active ? "Yes" : "No"}</td>
        </tr>
      ))}
    </MDTable>
  );
}
