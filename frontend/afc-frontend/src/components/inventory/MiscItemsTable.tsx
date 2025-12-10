import { useState } from "react";
import MDTable from "../table/MDtable";

export default function MiscItemsTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const rows = [
    { id: 1, name: "Foam Gasket", desc: "1/2 inch sealing gasket", supplier: "Aireon" }
  ];

  const total = rows.length;

  return (
    <MDTable
      title="Miscellaneous Items"
      columns={["ID", "Name", "Description", "Supplier"]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
    >
      {rows.map((r) => (
        <tr key={r.id}>
          <td>{r.id}</td>
          <td>{r.name}</td>
          <td>{r.desc}</td>
          <td>{r.supplier}</td>
        </tr>
      ))}
    </MDTable>
  );
}
