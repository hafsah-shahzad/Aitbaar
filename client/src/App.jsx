import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import HowitWorks from "./pages/HowitWorks";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard";
 
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowitWorks />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
 
export default App;
 