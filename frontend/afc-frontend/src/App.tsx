import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Order from "./pages/Orders";
import TransactionsPage from "./pages/Transactions";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/order" element={<Order />} />
        <Route path="/transactions" element={<TransactionsPage/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
