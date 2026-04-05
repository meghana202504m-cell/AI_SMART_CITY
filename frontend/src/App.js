import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ReportForm from "./pages/ReportForm";
import MapView from "./pages/MapView";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { FiHome, FiSend, FiMap, FiLogOut, FiUser } from "react-icons/fi";
import { verifyToken, logout as apiLogout } from "./services/api";

const navClass = ({ isActive }) =>
  isActive
    ? "flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-md"
    : "flex items-center gap-2 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium transition";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("authToken");
      if (token) {
        const result = await verifyToken();
        if (result.success) {
          setIsAuthenticated(true);
          setUser(result.data.user);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    apiLogout();
    setIsAuthenticated(false);
    setUser(null);
    navigate("/login");
  };

  // Show login/signup for unauthenticated users
  if (!isAuthenticated && location.pathname !== "/signup") {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Navigation Header */}
      <header className="bg-white shadow-md sticky top-0 z-50 border-b-4 border-purple-600">
        <div className="container mx-auto px-4">
          <div className="flex gap-4 items-center justify-between py-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏙️</span>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SYNORA
                </h1>
                <p className="text-xs text-slate-500">Real-time Urban Management</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex gap-3 items-center">
              <NavLink to="/" className={navClass} end>
                <FiHome className="w-5 h-5" />
                <span className="hidden md:inline">Dashboard</span>
              </NavLink>
              <NavLink to="/report" className={navClass}>
                <FiSend className="w-5 h-5" />
                <span className="hidden md:inline">Report</span>
              </NavLink>
              <NavLink to="/map" className={navClass}>
                <FiMap className="w-5 h-5" />
                <span className="hidden md:inline">Map</span>
              </NavLink>
            </nav>

            {/* User Section */}
            <div className="flex items-center gap-4">
              {isAuthenticated && user && (
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex flex-col items-end">
                    <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.locality || "User"}</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
                    <FiUser className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
              )}

              {/* Status Badge */}
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                <span className="text-xs font-semibold text-green-700">Live</span>
              </div>

              {/* Logout Button */}
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-700 hover:bg-red-50 font-medium transition"
                >
                  <FiLogOut className="w-5 h-5" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/report" element={<ReportForm />} />
            <Route path="/map" element={<MapView />} />
          </Routes>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-300 mt-12 border-t-4 border-purple-600">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            {/* About */}
            <div>
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                🏙️ Smart City AI
              </h3>
              <p className="text-sm">
                A comprehensive platform for urban management using AI and real-time data analytics.
              </p>
            </div>

            {/* Features */}
            <div>
              <h3 className="font-bold text-white mb-3">Features</h3>
              <ul className="text-sm space-y-2">
                <li>Chart Real-time traffic analysis</li>
                <li>Map Emergency route optimization</li>
                <li>File-text Citizen reporting system</li>
                <li>Zap AI waste classification</li>
                <li>Send Municipal alerts</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-bold text-white mb-3">Support</h3>
              <p className="text-sm mb-2">
                For issues and feedback, please contact us.
              </p>
              <p className="text-xs text-slate-400">
                © 2026 Smart City AI. All rights reserved.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-center text-slate-500">
              Made with heart for smarter cities | Powered by React, TailwindCSS & Flask
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
