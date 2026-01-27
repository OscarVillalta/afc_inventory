import MainLayout from "../layouts/MainLayout";
import TransactionsTable from "../components/transactions/TransactionsTable";

export default function TransactionsPage() {
  return (
    <MainLayout>
      <div className="p-6 w-full">
        {/* Page Title */}
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          Transactions
        </h1>

        <TransactionsTable />
      </div>
    </MainLayout>
  );
}
