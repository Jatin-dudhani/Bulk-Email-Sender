import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, onIdTokenChanged, signOut } from "firebase/auth";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { app } from "../utils/firebase";
import axios from "axios";
import { API_ENDPOINTS, getBaseUrl } from "../utils/constants";
import {
  FiMail,
  FiList,
  FiSettings,
  FiShield,
  FiLogOut,
  FiActivity,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";

const Header = () => {
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [serverStatus, setServerStatus] = useState({ online: false, data: null });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Check Backend Status
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await axios.get(API_ENDPOINTS.STATUS, { timeout: 3000 });
        if (isMounted) {
          setServerStatus({ online: true, data: res.data });
        }
      } catch (e) {
        if (isMounted) {
          setServerStatus({ online: false, data: null });
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Listen for Firebase Auth
  useEffect(() => {
    let auth = null;
    try {
      auth = getAuth(app);
    } catch (e) {
      // Firebase not initialized
      return;
    }

    const superAdminEmail = (process.env.REACT_APP_ADMIN_EMAIL || "jatindudhani07@gmail.com").toLowerCase().trim();

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserData(user);
        const isSuperAdminEmail = user.email && user.email.toLowerCase().trim() === superAdminEmail;
        try {
          const tokenResult = await user.getIdTokenResult();
          setIsAdmin(!!tokenResult.claims.admin || isSuperAdminEmail);
        } catch (e) {
          setIsAdmin(isSuperAdminEmail);
        }
      } else {
        // Fallback for local development if demo session exists
        const demoUser = localStorage.getItem("bulk_email_demo_user");
        if (demoUser) {
          try {
            const parsed = JSON.parse(demoUser);
            setUserData(parsed);
            const isUserAdmin =
              (parsed.email && parsed.email.toLowerCase().trim() === superAdminEmail) ||
              (parsed.isAdmin === true && parsed.email && parsed.email.toLowerCase().trim() === superAdminEmail);
            setIsAdmin(!!isUserAdmin);
          } catch (err) {}
        } else {
          setUserData(null);
          setIsAdmin(false);
        }
      }
    });

    const unsubscribeToken = onIdTokenChanged(auth, async (user) => {
      if (user) {
        const isSuperAdminEmail = user.email && user.email.toLowerCase().trim() === superAdminEmail;
        try {
          const tokenResult = await user.getIdTokenResult(true);
          const newAdminStatus = !!tokenResult.claims.admin || isSuperAdminEmail;
          setIsAdmin(newAdminStatus);
          if (!newAdminStatus && location.pathname === "/admin") {
            navigate("/home", { replace: true });
          }
        } catch (e) {
          setIsAdmin(isSuperAdminEmail);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, [location.pathname, navigate]);

  const handleSignOut = async () => {
    localStorage.removeItem("bulk_email_demo_user");
    localStorage.removeItem("bulk_email_sender_email");
    localStorage.removeItem("bulk_email_app_pass");
    try {
      const auth = getAuth(app);
      await signOut(auth);
    } catch (e) {}
    setUserData(null);
    setIsAdmin(false);
    navigate("/");
  };

  const navLinks = [
    { to: "/home", label: "Compose & Send", icon: FiMail },
    { to: "/lists", label: "Lists", icon: FiList },
    { to: "/email-settings", label: "Settings", icon: FiSettings },
    ...(isAdmin || !userData
      ? [{ to: "/admin", label: "Admin Panel", icon: FiShield }]
      : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0c101a]/95 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <Link to="/home" className="flex items-center space-x-3 group">
                <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm text-white">
                  <FiMail className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-base font-bold font-heading text-white tracking-tight">
                    Bulk Emailer
                  </span>
                  <div className="text-[11px] text-slate-400 font-normal leading-none">
                    Studio
                  </div>
                </div>
              </Link>

              {/* Server Status Pill */}
              <button
                onClick={() => setShowStatusModal(true)}
                title="View server health & connection details"
                className="ml-3 px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1.5 bg-slate-800/90 text-slate-300 border border-slate-700/70 hover:bg-slate-700/80 transition"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    serverStatus.online ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span className="text-[11px]">
                  {serverStatus.online
                    ? serverStatus.data?.mongodb?.connected
                      ? "Atlas Online"
                      : "Memory Mode"
                    : "Connecting..."}
                </span>
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? "bg-slate-800 text-white border border-slate-700 font-semibold shadow-sm"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Profile & Actions */}
            <div className="flex items-center space-x-3">
              {userData ? (
                <div className="flex items-center space-x-3">
                  <div className="hidden sm:block text-right">
                    <div className="text-xs font-semibold text-slate-200 leading-snug">
                      {userData.displayName || userData.email?.split("@")[0]}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                      {userData.email}
                    </div>
                  </div>

                  {userData.photoURL ? (
                    <img
                      src={userData.photoURL}
                      alt="Profile"
                      className="h-8 w-8 rounded-full border border-slate-700 object-cover shadow-sm"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs shadow-sm">
                      {(userData.displayName || userData.email || "U")[0].toUpperCase()}
                    </div>
                  )}

                  <button
                    onClick={handleSignOut}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                    title="Sign Out"
                  >
                    <FiLogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm border border-indigo-500/30 transition"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2.5 px-3 bg-slate-900/95 border-t border-slate-800/80">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center py-1 px-3 rounded text-xs font-medium ${
                  isActive ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4 mb-0.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* System Status Diagnostics Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card-surface rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <FiActivity className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold font-heading text-white">System Diagnostics</h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-white text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Backend API URL</span>
                <span className="font-mono text-slate-300 truncate max-w-[200px]" title={getBaseUrl()}>
                  {getBaseUrl()}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">API Server Status</span>
                <span className="flex items-center space-x-1.5 font-medium">
                  {serverStatus.online ? (
                    <span className="text-emerald-400 flex items-center space-x-1">
                      <FiCheckCircle className="h-3.5 w-3.5" />
                      <span>Online ({serverStatus.data?.nodeVersion})</span>
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center space-x-1">
                      <FiAlertTriangle className="h-3.5 w-3.5" />
                      <span>Offline / Connecting</span>
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Database Storage</span>
                <span className="font-medium text-slate-200">
                  {serverStatus.data?.mongodb?.connected ? (
                    <span className="text-emerald-400">✓ MongoDB Atlas</span>
                  ) : (
                    <span className="text-slate-300">In-Memory Fallback</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Firebase Auth</span>
                <span className="font-medium">
                  {serverStatus.data?.firebase?.configured ? (
                    <span className="text-emerald-400">✓ Ready</span>
                  ) : (
                    <span className="text-amber-400">Client Direct Mode</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Active Admin Email</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {serverStatus.data?.mainAdminEmail || process.env.REACT_APP_ADMIN_EMAIL || "jatindudhani07@gmail.com"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                to="/email-settings"
                onClick={() => setShowStatusModal(false)}
                className="py-2 rounded-lg btn-secondary text-xs font-semibold text-center flex items-center justify-center space-x-1"
              >
                <FiSettings className="h-3.5 w-3.5" />
                <span>Configure Server</span>
              </Link>
              <button
                onClick={() => setShowStatusModal(false)}
                className="py-2 rounded-lg btn-primary text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
