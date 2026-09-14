import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import HowItWorks from "./pages/HowItWorks";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminLogin from "./pages/adminLogin";
import AdminDashboard from "./pages/adminDashboard";
 
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
 
export default App;
 