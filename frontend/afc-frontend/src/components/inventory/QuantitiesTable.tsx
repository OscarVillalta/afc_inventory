import { useState } from "react";
import MDTable from "../table/MDtable";

export default function QuantitiesTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // FAKE DATA — replace with backend results
  const rows = [
    {
      productId: 1,
      onHand: 126,
      reserved: 12,
      ordered: 48,
      location: "Main Warehouse",
    },
  ];

  const total = rows.length;

  return (
    <MDTable
      title="Quantities"
      columns={["Product ID", "On Hand", "Reserved", "Ordered", "Location"]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
    >
      {rows.map((row, index) => (
        <tr key={index} className="bg-white shadow-sm rounded-xl">
          <td className="py-3 px-2">{row.productId}</td>
          <td className="py-3 px-2">{row.onHand}</td>
          <td className="py-3 px-2">{row.reserved}</td>
          <td className="py-3 px-2">{row.ordered}</td>
          <td className="py-3 px-2">{row.location}</td>
        </tr>
      ))}
    </MDTable>
  );
}
