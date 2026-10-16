import React, { useState, useEffect, useCallback } from "react";
import { getAuth } from "firebase/auth";
import axios from "axios";
import * as XLSX from "xlsx";
import Header from "./Header";
import { app } from "../utils/firebase";
import { API_ENDPOINTS } from "../utils/constants";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiTrash2,
  FiSend,
  FiDownload,
  FiUpload,
  FiSearch,
  FiUsers,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";

const Lists = () => {
  const [lists, setLists] = useState([]);
  const [expandedLists, setExpandedLists] = useState({});
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [selectedList, setSelectedList] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const navigate = useNavigate();

  const getEffectiveUserId = useCallback(() => {
    try {
      const auth = getAuth(app);
      if (auth.currentUser) return auth.currentUser.uid;
    } catch (e) {}

    const demoUser = localStorage.getItem("bulk_email_demo_user");
    if (demoUser) {
      try {
        return JSON.parse(demoUser).uid || "default_user";
      } catch (err) {}
    }
    return "default_user";
  }, []);

  const getCachedLists = useCallback((userId) => {
    try {
      const cached = localStorage.getItem(`bulk_email_cached_lists_${userId}`);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  }, []);

  const saveCachedLists = useCallback((userId, data) => {
    try {
      localStorage.setItem(`bulk_email_cached_lists_${userId}`, JSON.stringify(data));
    } catch (e) {}
  }, []);

  const fetchLists = useCallback(async () => {
    setIsLoading(true);
    const userId = getEffectiveUserId();
    try {
      const response = await axios.get(`${API_ENDPOINTS.EMAIL_LISTS}/${userId}`, { timeout: 3500 });
      const listsData = response.data || [];
      setLists(listsData);
      saveCachedLists(userId, listsData);
    } catch (err) {
      console.warn("Backend lists fetch notice, falling back to local store:", err.message);
      const localLists = getCachedLists(userId);
      setLists(localLists);
    } finally {
      setIsLoading(false);
    }
  }, [getEffectiveUserId, getCachedLists, saveCachedLists]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const userId = getEffectiveUserId();
    const newEntry = {
      _id: "local_" + Date.now(),
      userId,
      listName: newListName.trim(),
      description: newListDesc.trim(),
      emails: [],
      createdAt: new Date().toISOString(),
    };

    try {
      await axios.post(
        API_ENDPOINTS.EMAIL_LISTS,
        {
          userId,
          listName: newListName.trim(),
          description: newListDesc.trim(),
        },
        { timeout: 3500 }
      );
      fetchLists();
    } catch (err) {
      const current = getCachedLists(userId);
      const updated = [newEntry, ...current];
      saveCachedLists(userId, updated);
      setLists(updated);
    }

    setNewListName("");
    setNewListDesc("");
    setNotification({ type: "success", message: `List "${newListName}" created successfully!` });
  };

  const handleAddEmail = async (listId) => {
    if (!newEmail.trim()) return;

    // Support comma or whitespace separated emails
    const emailsToAdd = newEmail
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));

    if (emailsToAdd.length === 0) {
      setNotification({ type: "error", message: "Please enter valid email address(es)" });
      return;
    }

    const userId = getEffectiveUserId();
    try {
      await axios.post(
        `${API_ENDPOINTS.EMAIL_LISTS}/${listId}/emails`,
        {
          emails: emailsToAdd,
          userId,
        },
        { headers: { "X-User-ID": userId }, timeout: 3500 }
      );
      fetchLists();
    } catch (err) {
      const current = getCachedLists(userId);
      const updated = current.map((l) => {
        if (l._id === listId) {
          const combined = Array.from(new Set([...(l.emails || []), ...emailsToAdd]));
          return { ...l, emails: combined };
        }
        return l;
      });
      saveCachedLists(userId, updated);
      setLists(updated);
    }

    setNewEmail("");
    setNotification({
      type: "success",
      message: `Added ${emailsToAdd.length} email${emailsToAdd.length > 1 ? "s" : ""}!`,
    });
  };

  const handleRemoveEmail = async (listId, email) => {
    const userId = getEffectiveUserId();
    try {
      await axios.delete(
        `${API_ENDPOINTS.EMAIL_LISTS}/${listId}/emails/${encodeURIComponent(email)}?userId=${encodeURIComponent(userId)}`,
        { headers: { "X-User-ID": userId }, timeout: 3500 }
      );
      fetchLists();
    } catch (err) {
      const current = getCachedLists(userId);
      const updated = current.map((l) => {
        if (l._id === listId) {
          return { ...l, emails: (l.emails || []).filter((e) => e !== email) };
        }
        return l;
      });
      saveCachedLists(userId, updated);
      setLists(updated);
    }
  };

  const handleDeleteList = async (listId) => {
    const userId = getEffectiveUserId();
    try {
      await axios.delete(`${API_ENDPOINTS.EMAIL_LISTS}/${listId}?userId=${encodeURIComponent(userId)}`, {
        headers: { "X-User-ID": userId },
        timeout: 3500,
      });
      fetchLists();
    } catch (err) {
      const current = getCachedLists(userId);
      const updated = current.filter((l) => l._id !== listId);
      saveCachedLists(userId, updated);
      setLists(updated);
    }
    setShowDeleteModal(false);
    setNotification({ type: "success", message: "List deleted successfully" });
  };

  const handleFileUpload = async (listId, file) => {
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const extracted = [];
        rows.forEach((row) => {
          row.forEach((cell) => {
            const val = String(cell).trim();
            if (val.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
              extracted.push(val);
            }
          });
        });

        if (extracted.length === 0) {
          setNotification({ type: "error", message: "No valid email addresses found in file." });
          return;
        }

        const userId = getEffectiveUserId();
        await axios.post(
          `${API_ENDPOINTS.EMAIL_LISTS}/${listId}/emails`,
          {
            emails: extracted,
            userId,
          },
          { headers: { "X-User-ID": userId } }
        );
        fetchLists();
        setNotification({
          type: "success",
          message: `Imported ${extracted.length} emails into list!`,
        });
      } catch (err) {
        setNotification({ type: "error", message: "Error parsing spreadsheet: " + err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportListToExcel = (list) => {
    const data = (list.emails || []).map((email, idx) => ({
      Index: idx + 1,
      Email: email,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, list.listName.slice(0, 31));
    XLSX.writeFile(workbook, `${list.listName.replace(/\s+/g, "_")}.xlsx`);
  };

  const filteredLists = lists.filter(
    (l) =>
      l.listName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#090d16]">
      <Header />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold font-heading text-white tracking-tight">
              Email Audiences & Lists
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Organize your contacts into reusable lists for targeted bulk email broadcasts.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate("/home")}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold btn-primary"
            >
              <FiSend className="h-3.5 w-3.5" />
              <span>Compose Campaign</span>
            </button>
          </div>
        </div>

        {/* Notification Alert */}
        {notification && (
          <div
            className={`mb-6 p-3.5 rounded-xl flex items-center justify-between border text-xs font-medium ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white ml-4"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Create List Form (4 cols) */}
          <div className="lg:col-span-4">
            <div className="card-surface rounded-2xl p-6 sticky top-24 border border-slate-800">
              <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-slate-800">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                  <FiPlus className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold font-heading text-white">
                  Create Audience List
                </h2>
              </div>

              <form onSubmit={handleCreateList} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                    List Name
                  </label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g. Beta Testers, VIP Clients"
                    className="w-full px-3 py-2 rounded-lg input-surface text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={newListDesc}
                    onChange={(e) => setNewListDesc(e.target.value)}
                    placeholder="Brief notes about this recipient segment..."
                    className="w-full px-3 py-2 rounded-lg input-surface text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg font-semibold text-xs btn-primary flex items-center justify-center space-x-2"
                >
                  <FiPlus className="h-3.5 w-3.5" />
                  <span>Create Audience List</span>
                </button>
              </form>
            </div>
          </div>

          {/* Lists Roster & Management (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Search Bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3.5 top-3.5 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search lists by name or description..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm"
                />
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {lists.length} List{lists.length === 1 ? "" : "s"} total
              </span>
            </div>

            {/* List Cards */}
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">Loading lists...</div>
            ) : filteredLists.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <FiUsers className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-300">No Lists Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? "No lists matched your search query."
                    : "Create your first email list using the form on the left to start organizing your audience."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLists.map((list) => {
                  const isExpanded = !!expandedLists[list._id];
                  const emailCount = list.emails?.length || 0;

                  return (
                    <div
                      key={list._id}
                      className="glass-card rounded-2xl p-6 transition-all duration-200 border border-slate-800 hover:border-slate-700"
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-bold font-heading text-white">
                              {list.listName}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {emailCount} email{emailCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          {list.description && (
                            <p className="text-xs text-slate-400">{list.description}</p>
                          )}
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => exportListToExcel(list)}
                            disabled={emailCount === 0}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-40"
                            title="Export list to Excel"
                          >
                            <FiDownload className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedList(list);
                              setShowDeleteModal(true);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Delete List"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setExpandedLists((prev) => ({
                                ...prev,
                                [list._id]: !prev[list._id],
                              }))
                            }
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                          >
                            <span>{isExpanded ? "Collapse" : "Manage"}</span>
                            {isExpanded ? (
                              <FiChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <FiChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div className="mt-6 pt-6 border-t border-slate-800 space-y-5 animate-in fade-in duration-150">
                          {/* Add Single or Multi Email Field */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                              Add Emails to this List
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="Enter email address (or comma-separated emails)"
                                className="flex-1 px-3.5 py-2 rounded-xl glass-input text-xs font-mono"
                              />
                              <button
                                onClick={() => handleAddEmail(list._id)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
                              >
                                Add
                              </button>
                            </div>
                          </div>

                          {/* SpreadSheet Upload for List */}
                          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
                            <span className="text-xs text-slate-400">
                              Import batch contacts from Excel / CSV into this list:
                            </span>
                            <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition flex items-center space-x-1.5">
                              <FiUpload className="h-3.5 w-3.5" />
                              <span>Import File</span>
                              <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={(e) => handleFileUpload(list._id, e.target.files[0])}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {/* Email Pills container */}
                          <div>
                            <div className="text-xs font-semibold text-slate-400 mb-2">
                              Members ({emailCount})
                            </div>
                            {emailCount === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-500 rounded-xl bg-slate-900/30">
                                This list has no emails yet.
                              </div>
                            ) : (
                              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                                {list.emails.map((email, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 text-xs font-mono text-slate-300"
                                  >
                                    <span className="truncate pr-2">{email}</span>
                                    <button
                                      onClick={() => handleRemoveEmail(list._id, email)}
                                      className="text-slate-500 hover:text-rose-400 p-1"
                                      title="Remove from list"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 text-slate-100 shadow-2xl">
            <h3 className="text-lg font-bold font-heading text-white mb-2">
              Delete Audience List?
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-slate-200">{selectedList?.listName}</strong>? All
              contacts saved in this segment will be permanently deleted.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteList(selectedList._id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lists;
