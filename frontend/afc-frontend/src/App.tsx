import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Order from "./pages/Orders";
import OrdersSearch from "./pages/OrdersSearch";
import TransactionsPage from "./pages/Transactions";
import OrderDetailPage from "./components/order/OrderDetailPage";
import ProductDetailPage from "./pages/ProductDetailPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/order" element={<Order />} />
        <Route path="/orders/search" element={<OrdersSearch />} />
        <Route path="/transactions" element={<TransactionsPage/>}/>
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
