import MDTable from "../table/MDtable";

export default function ProductsTable() {
  return (
    <MDTable
      title="Product Catalog"
      columns={["ID", "Type", "Identifier", "Category", "Active"]}
    >
      <tr className="bg-white shadow-sm rounded-xl">
        <td className="py-3 px-2">1</td>
        <td className="py-3 px-2">Filter</td>
        <td className="py-3 px-2">FGP-12x24x2</td>
        <td className="py-3 px-2">Box Filter</td>
        <td className="py-3 px-2">Yes</td>
      </tr>
    </MDTable>
  );
}
