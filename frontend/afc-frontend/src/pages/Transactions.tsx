import MainLayout from "../layouts/MainLayout";
import TransactionsTable from "../components/transactions/TransactionsTable";

export default function TransactionsPage() {
  return (
    <MainLayout>
      <div className="p-6 w-full">
        {/* 🔟 Page Title Context */}
        <h1 className="text-2xl font-bold text-gray-800">
          Transactions Ledger
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          Immutable record of all inventory movement f
        </p>

        <TransactionsTable />
      </div>
    </MainLayout>
  );
}
