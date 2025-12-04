import MDTable from "../table/MDtable";

export default function MiscItemsTable() {
  return (
    <MDTable
      title="Miscellaneous Items"
      columns={["ID", "Name", "Description", "Supplier"]}
    >
      <tr className="bg-white shadow-sm rounded-xl">
        <td className="py-3 px-2">1</td>
        <td className="py-3 px-2">Foam Gasket</td>
        <td className="py-3 px-2">1/2 inch sealing gasket</td>
        <td className="py-3 px-2">Aireon</td>
      </tr>
    </MDTable>
  );
}
