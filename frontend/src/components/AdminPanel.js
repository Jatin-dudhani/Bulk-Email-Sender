import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { getAuth } from "firebase/auth";
import Header from "./Header";
import { app } from "../utils/firebase";
import { FiRefreshCw, FiShield, FiUserCheck, FiUserX, FiUsers, FiUserPlus, FiLock } from "react-icons/fi";
import { API_ENDPOINTS } from "../utils/constants";

const AdminPanel = () => {
  const [newUserEmail, setNewUserEmail] = useState("");
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mainAdminEmail = process.env.REACT_APP_ADMIN_EMAIL || "jatindudhani07@gmail.com";

  const getAuthHeaders = useCallback(async () => {
    let token = null;
    try {
      const auth = getAuth(app);
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
    } catch (e) {}

    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const demoUser = localStorage.getItem("bulk_email_demo_user");
    if (demoUser) {
      try {
        const parsed = JSON.parse(demoUser);
        headers["X-Admin-Email"] = parsed.email || mainAdminEmail;
      } catch (e) {}
    } else {
      headers["X-Admin-Email"] = mainAdminEmail;
    }

    return headers;
  }, [mainAdminEmail]);

  const fetchAuthorizedUsers = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(API_ENDPOINTS.AUTHORIZED_USERS, { headers });
      setAuthorizedUsers(response.data.users || []);
    } catch (error) {
      setMessage({
        type: "error",
        text: "Error fetching users: " + (error.response?.data?.error || error.message),
      });
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchAuthorizedUsers();
  }, [fetchAuthorizedUsers]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const grantAccess = async (e) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(newUserEmail)) {
      setMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      await axios.post(
        API_ENDPOINTS.GRANT_ACCESS,
        { userEmailToGrant: newUserEmail.trim() },
        { headers }
      );
      setMessage({ type: "success", text: `Access granted successfully to ${newUserEmail}!` });
      setNewUserEmail("");
      fetchAuthorizedUsers();
    } catch (error) {
      if (error.response?.data?.error?.includes("no user record")) {
        setMessage({
          type: "error",
          text: "User must sign in at least once before being granted access.",
        });
      } else {
        setMessage({
          type: "error",
          text: error.response?.data?.error || "Error granting access",
        });
      }
    }
  };

  const toggleAdminStatus = async (userEmail) => {
    if (userEmail === mainAdminEmail) {
      setMessage({ type: "error", text: "Cannot modify main admin privileges." });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        API_ENDPOINTS.TOGGLE_ADMIN,
        { targetUserEmail: userEmail },
        { headers }
      );
      setMessage({ type: "success", text: res.data.message || "Admin status updated!" });
      fetchAuthorizedUsers();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Error updating admin status",
      });
    }
  };

  const revokeAccess = async (userEmail) => {
    if (userEmail === mainAdminEmail) {
      setMessage({ type: "error", text: "Cannot revoke main admin privileges." });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      await axios.post(
        API_ENDPOINTS.REVOKE_ACCESS,
        { userEmailToRevoke: userEmail },
        { headers }
      );
      setMessage({ type: "success", text: `Access revoked from ${userEmail}.` });
      fetchAuthorizedUsers();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Error revoking access",
      });
    }
  };

  const adminCount = authorizedUsers.filter((u) => u.isAdmin).length;

  return (
    <div className="min-h-screen bg-[#090d16]">
      <Header />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold font-heading text-white tracking-tight">
              System Administration
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Manage authorized users, grant system permissions, and configure administrative roles.
            </p>
          </div>

          <button
            onClick={fetchAuthorizedUsers}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold btn-secondary transition"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh Users</span>
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mb-6 p-3.5 rounded-xl flex items-center justify-between border text-xs font-medium ${
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white ml-4">
              ✕
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="card-surface rounded-2xl p-6 flex items-center space-x-4 border border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700/60">
              <FiUsers className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-white">
                {authorizedUsers.length}
              </div>
              <div className="text-xs text-slate-400 font-medium">Authorized Users</div>
            </div>
          </div>

          <div className="card-surface rounded-2xl p-6 flex items-center space-x-4 border border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700/60">
              <FiShield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-white">{adminCount}</div>
              <div className="text-xs text-slate-400 font-medium">Administrators</div>
            </div>
          </div>

          <div className="card-surface rounded-2xl p-6 flex items-center space-x-4 border border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700/60">
              <FiLock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-slate-200 truncate max-w-[180px]">
                {mainAdminEmail}
              </div>
              <div className="text-xs text-slate-400 font-medium">Root Superadmin</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Grant Access Card (4 cols) */}
          <div className="lg:col-span-4">
            <div className="card-surface rounded-2xl p-6 sticky top-24 border border-slate-800">
              <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-slate-800">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                  <FiUserPlus className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold font-heading text-white">
                  Grant Access
                </h2>
              </div>

              <form onSubmit={grantAccess} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                    User Google Email
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full px-3 py-2 rounded-lg input-surface text-xs"
                    required
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    The user must have logged into the app with Google at least once.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg font-semibold text-xs btn-primary flex items-center justify-center space-x-2"
                >
                  <FiUserCheck className="h-3.5 w-3.5" />
                  <span>Grant App Access</span>
                </button>
              </form>
            </div>
          </div>

          {/* User Roster Table (8 cols) */}
          <div className="lg:col-span-8">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
                <h2 className="text-base font-bold font-heading text-white">
                  Authorized Users List
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  {authorizedUsers.length} total
                </span>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Loading authorized users...
                </div>
              ) : authorizedUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No authorized users found.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {authorizedUsers.map((user, idx) => {
                    const isMainAdmin = user.email === mainAdminEmail;

                    return (
                      <div
                        key={idx}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <div
                            className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs ${
                              user.isAdmin
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {(user.email || "U")[0].toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="text-sm font-semibold text-slate-200 truncate">
                              {user.email}
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              {user.isAdmin ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                                  {isMainAdmin ? "Super Admin" : "Admin"}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                  Standard User
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center space-x-2 self-end sm:self-center">
                          {!isMainAdmin && (
                            <>
                              <button
                                onClick={() => toggleAdminStatus(user.email)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                  user.isAdmin
                                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                                }`}
                              >
                                {user.isAdmin ? "Demote" : "Make Admin"}
                              </button>
                              <button
                                onClick={() => revokeAccess(user.email)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title="Revoke all access"
                              >
                                <FiUserX className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {isMainAdmin && (
                            <span className="text-xs font-mono text-slate-500 italic px-2">
                              Protected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
