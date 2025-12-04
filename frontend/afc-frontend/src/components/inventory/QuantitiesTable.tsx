import MDTable from "../table/MDtable";

export default function QuantitiesTable() {
  return (
    <MDTable
      title="Quantities"
      columns={["Product ID", "On Hand", "Reserved", "Ordered", "Location"]}
    >
      <tr className="bg-white shadow-sm rounded-xl">
        <td className="py-3 px-2">1</td>
        <td className="py-3 px-2">126</td>
        <td className="py-3 px-2">12</td>
        <td className="py-3 px-2">48</td>
        <td className="py-3 px-2">Main Warehouse</td>
      </tr>
    </MDTable>
  );
}
