import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../utils/firebase";
import { API_ENDPOINTS, getBaseUrl } from "../utils/constants";
import {
  FiSend,
  FiUpload,
  FiList,
  FiEdit3,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiPaperclip,
  FiTrash2,
  FiRefreshCw,
  FiDownload,
  FiUserCheck,
  FiKey,
  FiClock,
} from "react-icons/fi";

const TEMPLATES = [
  {
    id: "announcement",
    name: "🚀 Product Announcement",
    subject: "Exciting News: Introducing something new for you, {name}!",
    body: `Hi {name},

We are thrilled to announce a major update designed to make your workflow smoother and faster.

Here is what's new:
• Blazing fast performance
• Redesigned intuitive dashboard
• Automated batch reporting

We would love to hear your thoughts. Reply directly to this email to let us know what you think!

Best regards,
The Team`,
  },
  {
    id: "newsletter",
    name: "📰 Monthly Newsletter",
    subject: "Your Monthly Update & Highlights — {name}",
    body: `Hello {name},

Welcome to this month's digest! Here are the key stories and updates curated especially for you:

1. Top industry trends you should know this quarter
2. Pro tips for maximizing your team productivity
3. Upcoming community events and webinars

Thank you for being part of our community, {name}!

Warmly,
The Editorial Team`,
  },
  {
    id: "welcome",
    name: "👋 Welcome Onboarding",
    subject: "Welcome aboard, {name}! Let's get you started",
    body: `Hi {name},

Welcome! We are so excited to have you join us.

To help you get the most out of your experience, here are 3 quick steps to get started:
1. Complete your account profile
2. Explore our quickstart guide
3. Reach out anytime if you need help

If you have any questions, simply reply to this email ({email}) and our support team will assist you.

Cheers,
Customer Success Team`,
  },
  {
    id: "outreach",
    name: "💼 Professional Outreach",
    subject: "Quick question for {name}",
    body: `Hi {name},

I hope this email finds you well.

I came across your profile and was impressed by your recent work. I am reaching out to see if you would be open to a brief 10-minute conversation this week regarding collaborative opportunities.

Looking forward to hearing from you.

Best,
Business Development`,
  },
];

function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email.trim());
}

function extractNameFromEmail(email) {
  if (!email || !email.includes("@")) return "Friend";
  const localPart = email.split("@")[0];
  const nameParts = localPart
    .split(/[._+-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  return nameParts.join(" ") || "Friend";
}

const Body = () => {
  // Input mode: 'file', 'lists', 'manual'
  const [inputMode, setInputMode] = useState("file");

  // Recipients state
  const [recipients, setRecipients] = useState([]);
  const [searchFilter, setSearchFilter] = useState("");

  // Email content
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [activeTab, setActiveTab] = useState("compose"); // 'compose' or 'preview'

  // Sender Credentials
  const [senderEmail, setSenderEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [throttleDelay, setThrottleDelay] = useState(250); // ms

  // Saved Lists
  const [savedLists, setSavedLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [loadingLists, setLoadingLists] = useState(false);

  // Manual input state
  const [manualText, setManualText] = useState("");

  // Sending & Progress states
  const [isSending, setIsSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentProgressInfo, setCurrentProgressInfo] = useState(null);
  const [campaignResults, setCampaignResults] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const eventSourceRef = useRef(null);

  const getUserScopeKey = (user) => {
    if (user?.uid) return user.uid.replace(/[^a-zA-Z0-9]/g, "_");
    if (user?.email) return user.email.replace(/[^a-zA-Z0-9]/g, "_");

    try {
      const auth = getAuth(app);
      if (auth.currentUser?.uid) return auth.currentUser.uid.replace(/[^a-zA-Z0-9]/g, "_");
      if (auth.currentUser?.email) return auth.currentUser.email.replace(/[^a-zA-Z0-9]/g, "_");
    } catch (e) {}

    const demoUser = localStorage.getItem("bulk_email_demo_user");
    if (demoUser) {
      try {
        const parsed = JSON.parse(demoUser);
        return (parsed.uid || parsed.email || "guest").replace(/[^a-zA-Z0-9]/g, "_");
      } catch (err) {}
    }
    return "guest";
  };

  // Load saved credentials & saved lists on mount
  useEffect(() => {
    // Purge dangerous legacy shared keys from previous sessions so they can never leak
    localStorage.removeItem("bulk_email_app_pass");
    localStorage.removeItem("bulk_email_sender_email");

    const loadCredentialsForUser = (userEmail, userUid) => {
      const scope = (userUid || userEmail || "guest").replace(/[^a-zA-Z0-9]/g, "_");
      const savedEmail = localStorage.getItem(`bulk_email_sender_email_${scope}`);
      const savedPass = localStorage.getItem(`bulk_email_app_pass_${scope}`);

      // Default sender email is the currently logged-in user's own email
      setSenderEmail(savedEmail || userEmail || "");
      // App password must NEVER be shared across accounts - only this user's password
      setAppPassword(savedPass || "");
    };

    let auth = null;
    try {
      auth = getAuth(app);
    } catch (e) {}

    let unsub = () => {};
    if (auth) {
      unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          loadCredentialsForUser(user.email, user.uid);
          fetchUserLists(user.uid);
        } else {
          const demoUserStr = localStorage.getItem("bulk_email_demo_user");
          if (demoUserStr) {
            try {
              const demo = JSON.parse(demoUserStr);
              loadCredentialsForUser(demo.email, demo.uid);
              fetchUserLists(demo.uid);
            } catch (err) {
              setSenderEmail("");
              setAppPassword("");
            }
          } else {
            setSenderEmail("");
            setAppPassword("");
          }
        }
      });
    } else {
      const demoUserStr = localStorage.getItem("bulk_email_demo_user");
      if (demoUserStr) {
        try {
          const demo = JSON.parse(demoUserStr);
          loadCredentialsForUser(demo.email, demo.uid);
          fetchUserLists(demo.uid);
        } catch (err) {}
      }
    }

    return () => unsub();
  }, []);

  const fetchUserLists = async () => {
    setLoadingLists(true);
    let userId = "default_user";
    try {
      const auth = getAuth(app);
      if (auth.currentUser) {
        userId = auth.currentUser.uid;
      }
    } catch (e) {}

    try {
      const res = await axios.get(`${API_ENDPOINTS.EMAIL_LISTS}/${userId}`, { timeout: 3500 });
      const listsData = res.data || [];
      setSavedLists(listsData);
      localStorage.setItem(`bulk_email_cached_lists_${userId}`, JSON.stringify(listsData));
    } catch (err) {
      console.warn("Could not load user lists from API, falling back to local storage:", err.message);
      const cached = localStorage.getItem(`bulk_email_cached_lists_${userId}`);
      if (cached) {
        try {
          setSavedLists(JSON.parse(cached));
        } catch (e) {}
      }
    } finally {
      setLoadingLists(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const tmpl = TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setSubject(tmpl.subject);
      setBody(tmpl.body);
    }
  };

  // Insert variable into subject or body
  const insertVariable = (variable) => {
    setBody((prev) => prev + ` ${variable} `);
  };

  // Handle File Upload (.xlsx, .xls, .csv)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCsv = fileName.endsWith(".csv");

    if (!isExcel && !isCsv) {
      setStatusMessage({
        type: "error",
        text: "Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)",
      });
      return;
    }

    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

          parseAndSetRecipients(jsonData);
        } catch (err) {
          setStatusMessage({ type: "error", text: "Error parsing Excel file: " + err.message });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV
      reader.onload = (event) => {
        try {
          const text = event.target.result;
          const workbook = XLSX.read(text, { type: "string" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

          parseAndSetRecipients(jsonData);
        } catch (err) {
          setStatusMessage({ type: "error", text: "Error parsing CSV: " + err.message });
        }
      };
      reader.readAsText(file);
    }
  };

  const parseAndSetRecipients = (rows) => {
    const parsed = [];

    rows.forEach((row) => {
      // Find keys matching email
      let emailVal = "";
      let nameVal = "";

      Object.entries(row).forEach(([key, val]) => {
        const k = key.trim().toLowerCase();
        const v = String(val).trim();
        if (
          !emailVal &&
          (k === "email" ||
            k === "email address" ||
            k === "e-mail" ||
            k === "mail" ||
            v.includes("@"))
        ) {
          if (v.includes("@")) emailVal = v;
        }

        if (
          !nameVal &&
          (k === "name" ||
            k === "full name" ||
            k === "first name" ||
            k === "recipient" ||
            k === "contact")
        ) {
          nameVal = v;
        }
      });

      if (emailVal) {
        parsed.push({
          email: emailVal,
          name: nameVal || extractNameFromEmail(emailVal),
        });
      }
    });

    if (parsed.length === 0) {
      setStatusMessage({
        type: "error",
        text: "No valid email addresses found in the file. Ensure the file contains an 'Email' column.",
      });
      return;
    }

    setRecipients(parsed);
    setStatusMessage({
      type: "success",
      text: `Successfully imported ${parsed.length} recipients!`,
    });
  };

  // Load from saved list
  const handleLoadList = (listId) => {
    setSelectedListId(listId);
    const list = savedLists.find((l) => l._id === listId);
    if (!list) return;

    const listRecipients = (list.emails || []).map((email) => ({
      email: typeof email === "string" ? email.trim() : email.email || "",
      name:
        typeof email === "object" && email.name
          ? email.name
          : extractNameFromEmail(typeof email === "string" ? email : email.email),
    }));

    setRecipients(listRecipients);
    setStatusMessage({
      type: "success",
      text: `Loaded ${listRecipients.length} recipients from list "${list.listName}"`,
    });
  };

  // Parse Manual input
  const handleParseManual = () => {
    if (!manualText.trim()) return;

    const lines = manualText.split(/[\n,;]+/);
    const parsed = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check if format is "Name <email@domain.com>"
      const bracketMatch = trimmed.match(/^(.*?)\s*<(.+@.+)>$/);
      if (bracketMatch) {
        parsed.push({
          name: bracketMatch[1].replace(/['"]/g, "").trim(),
          email: bracketMatch[2].trim(),
        });
      } else if (trimmed.includes("@")) {
        parsed.push({
          email: trimmed,
          name: extractNameFromEmail(trimmed),
        });
      }
    });

    if (parsed.length === 0) {
      setStatusMessage({ type: "error", text: "No valid emails detected in pasted text." });
      return;
    }

    setRecipients(parsed);
    setStatusMessage({
      type: "success",
      text: `Parsed ${parsed.length} recipients from manual input!`,
    });
  };

  // Recipient management actions
  const removeRecipient = (indexToRemove) => {
    setRecipients((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const removeDuplicates = () => {
    const seen = new Set();
    const unique = [];
    recipients.forEach((r) => {
      const lower = r.email.toLowerCase().trim();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(r);
      }
    });

    const removedCount = recipients.length - unique.length;
    setRecipients(unique);
    setStatusMessage({
      type: "success",
      text: `Removed ${removedCount} duplicate recipient${removedCount === 1 ? "" : "s"}.`,
    });
  };

  const removeInvalid = () => {
    const validOnly = recipients.filter((r) => validateEmail(r.email));
    const removedCount = recipients.length - validOnly.length;
    setRecipients(validOnly);
    setStatusMessage({
      type: "success",
      text: `Filtered out ${removedCount} invalid recipient${removedCount === 1 ? "" : "s"}.`,
    });
  };

  // Attachments
  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Send Single Test Email
  const handleSendTestEmail = async () => {
    if (!senderEmail || !appPassword) {
      setStatusMessage({
        type: "error",
        text: "Please provide both Sender Email and Google App Password.",
      });
      return;
    }

    setSendingTest(true);
    setStatusMessage({ type: "info", text: "Sending test email to " + senderEmail + "..." });

    try {
      const res = await axios.post(API_ENDPOINTS.TEST_EMAIL, {
        senderEmail,
        appPassword,
        testRecipient: senderEmail,
      });

      if (res.data.success) {
        setStatusMessage({
          type: "success",
          text: `✓ Test email successfully sent to ${senderEmail}! Check your inbox.`,
        });
      }
    } catch (err) {
      const serverUrl = getBaseUrl();
      const isNetErr = !err.response || err.code === "ECONNABORTED" || err.message?.includes("Network Error");
      setStatusMessage({
        type: "error",
        text: isNetErr
          ? `Cannot reach backend API server at ${serverUrl}. Ensure the server is online or configure the URL in Settings.`
          : "Test email failed: " + (err.response?.data?.error || err.message),
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Send Bulk Campaign
  const handleSendEmails = async () => {
    const validList = recipients.filter((r) => validateEmail(r.email));

    if (validList.length === 0) {
      setStatusMessage({
        type: "error",
        text: "No valid recipients to send to. Please add at least one valid recipient.",
      });
      return;
    }

    if (!subject.trim()) {
      setStatusMessage({ type: "error", text: "Subject cannot be empty." });
      return;
    }

    if (!body.trim()) {
      setStatusMessage({ type: "error", text: "Email body cannot be empty." });
      return;
    }

    if (!senderEmail || !appPassword) {
      setStatusMessage({
        type: "error",
        text: "Sender credentials are required. Fill in Sender Email and Google App Password.",
      });
      return;
    }

    if (rememberCredentials) {
      const scope = getUserScopeKey();
      localStorage.setItem(`bulk_email_sender_email_${scope}`, senderEmail.trim());
      localStorage.setItem(`bulk_email_app_pass_${scope}`, appPassword.trim());
    }

    setIsSending(true);
    setProgressPercent(0);
    setCurrentProgressInfo(null);
    setCampaignResults(null);
    setStatusMessage(null);

    const sessionId = "session_" + Date.now();

    // Start SSE listener
    try {
      const sseUrl = `${API_ENDPOINTS.SEND_PROGRESS}?sessionId=${sessionId}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === "sent" || data.status === "failed") {
            setCurrentProgressInfo(data);
            setProgressPercent(data.percent || 0);
          } else if (data.type === "complete") {
            setProgressPercent(100);
          }
        } catch (e) {}
      };

      es.onerror = () => {
        es.close();
      };
    } catch (err) {
      console.warn("SSE connection error:", err);
    }

    try {
      const formData = new FormData();
      formData.append("valid", JSON.stringify(validList));
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("senderEmail", senderEmail);
      formData.append("appPassword", appPassword);
      formData.append("sessionId", sessionId);
      formData.append("delayMs", throttleDelay);

      attachments.forEach((file) => {
        formData.append("attachments", file);
      });

      const response = await axios.post(API_ENDPOINTS.SEND_EMAILS, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setProgressPercent(100);
      setCampaignResults(response.data);
      setStatusMessage({
        type: "success",
        text: `Campaign finished! Sent: ${response.data.sent}, Failed: ${response.data.failed}`,
      });
    } catch (error) {
      console.error("Campaign send error:", error);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      const serverUrl = getBaseUrl();
      const isNetErr = !error.response || error.code === "ECONNABORTED" || error.message?.includes("Network Error");
      setStatusMessage({
        type: "error",
        text: isNetErr
          ? `Cannot reach backend API server at ${serverUrl}. Ensure the server is online or configure the URL in Settings.`
          : "Campaign error: " + (error.response?.data?.error || error.message),
      });
    } finally {
      setIsSending(false);
    }
  };

  // Export Results Report to CSV
  const exportResultsToCsv = () => {
    if (!campaignResults || !campaignResults.details) return;

    const data = campaignResults.details.map((item) => ({
      Recipient_Name: item.name,
      Recipient_Email: item.email,
      Delivery_Status: item.status,
      Failure_Reason: item.error || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Send_Report");
    XLSX.writeFile(workbook, `campaign_report_${Date.now()}.xlsx`);
  };

  // Compute recipient statistics
  const validCount = recipients.filter((r) => validateEmail(r.email)).length;
  const invalidCount = recipients.length - validCount;
  const filteredRecipients = searchFilter
    ? recipients.filter(
        (r) =>
          r.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
          r.name.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : recipients;

  // Sample preview recipient
  const previewRecipient = recipients[0] || {
    name: "Alex Johnson",
    email: "alex@example.com",
  };
  const previewSubject = subject.replace(/{name}/gi, previewRecipient.name).replace(/{email}/gi, previewRecipient.email);
  const previewBody = body.replace(/{name}/gi, previewRecipient.name).replace(/{email}/gi, previewRecipient.email);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Page Title & Tagline */}
      <div className="mb-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white tracking-tight">
            Bulk Email Campaign Studio
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Create, personalize, and deliver bulk email campaigns with real-time tracking.
          </p>
        </div>

        {/* Quick Test Email Button */}
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={handleSendTestEmail}
            disabled={sendingTest || isSending || !senderEmail || !appPassword}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold btn-secondary disabled:opacity-50"
            title="Send a sample email to yourself first"
          >
            <FiEye className="h-3.5 w-3.5 text-slate-300" />
            <span>{sendingTest ? "Sending Test..." : "Send Test to Self"}</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`mb-6 p-3.5 rounded-xl flex items-start justify-between border text-xs font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : statusMessage.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : "bg-slate-800 border-slate-700 text-slate-200"
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {statusMessage.type === "success" ? (
              <FiCheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
            ) : statusMessage.type === "error" ? (
              <FiXCircle className="h-4 w-4 flex-shrink-0 text-rose-400" />
            ) : (
              <FiRefreshCw className="h-4 w-4 flex-shrink-0 animate-spin text-slate-300" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white text-xs ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left Column (Compose & Credentials) + Right Column (Recipients & Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Sender & Compose (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Sender Credentials Card */}
          <div className="card-surface rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                  <FiKey className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold font-heading text-white">
                    Sender Credentials
                  </h2>
                  <p className="text-[11px] text-slate-400">Gmail SMTP authentication</p>
                </div>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                SSL 465
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                  Sender Gmail
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full px-3 py-2 rounded-lg input-surface text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                  16-Digit App Password
                </label>
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="•••• •••• •••• ••••"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm font-mono"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberCredentials}
                  onChange={(e) => setRememberCredentials(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Remember credentials in browser</span>
              </label>

              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <span>Get App Password</span>
                <span>↗</span>
              </a>
            </div>
          </div>

          {/* Email Composer Card */}
          <div className="glass-card rounded-2xl p-6">
            {/* Header with Template Selector & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab("compose")}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === "compose"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Compose
                </button>
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === "preview"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FiEye className="h-4 w-4" />
                  <span>Preview</span>
                </button>
              </div>

              {/* Template Picker Dropdown */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Template:</span>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg glass-input text-xs font-medium cursor-pointer"
                >
                  <option value="">Custom Blank</option>
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeTab === "compose" ? (
              <div className="space-y-4">
                {/* Subject Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Email Subject
                    </label>
                    <span className="text-xs text-slate-500">
                      Supports tags like {"{name}"}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject line (e.g. Important Update for {name})"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm"
                  />
                </div>

                {/* Variable Inserter Quick Bar */}
                <div className="flex items-center space-x-2 py-1">
                  <span className="text-xs text-slate-400">Insert tag:</span>
                  <button
                    type="button"
                    onClick={() => insertVariable("{name}")}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition"
                  >
                    + {"{name}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable("{email}")}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition"
                  >
                    + {"{email}"}
                  </button>
                </div>

                {/* Body Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Email Body
                    </label>
                    <span className="text-xs text-slate-500">HTML or plain text</span>
                  </div>
                  <textarea
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type your email content here... Use {name} to personalize each recipient."
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm leading-relaxed resize-y font-normal"
                  />
                </div>

                {/* Attachments Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <FiPaperclip className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Attachments (Max 25MB total)</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <label className="cursor-pointer px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition flex items-center space-x-1.5">
                      <FiUpload className="h-3.5 w-3.5" />
                      <span>Choose Files</span>
                      <input
                        type="file"
                        multiple
                        onChange={handleAttachmentChange}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-500">
                      {attachments.length === 0
                        ? "No files attached"
                        : `${attachments.length} file(s) attached`}
                    </span>
                  </div>

                  {attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-200"
                        >
                          <span className="truncate max-w-[150px]">{file.name}</span>
                          <span className="text-slate-500 text-[10px]">
                            ({Math.round(file.size / 1024)} KB)
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="text-slate-400 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Throttle Rate Slider */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <FiClock className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Anti-Spam Throttling Delay:</span>
                    </span>
                    <span className="font-mono text-indigo-300 font-semibold">
                      {throttleDelay} ms / email
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1500"
                    step="50"
                    value={throttleDelay}
                    onChange={(e) => setThrottleDelay(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Fast (50ms)</span>
                    <span>Safe (250ms)</span>
                    <span>Conservative (1.5s)</span>
                  </div>
                </div>

                {/* Primary Send Button */}
                <button
                  type="button"
                  onClick={handleSendEmails}
                  disabled={isSending || recipients.length === 0}
                  className={`w-full mt-4 py-3.5 px-6 rounded-xl font-bold font-heading text-sm flex items-center justify-center space-x-2.5 transition ${
                    isSending || recipients.length === 0
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : "btn-primary"
                  }`}
                >
                  <FiSend className={`h-4 w-4 ${isSending ? "animate-pulse" : ""}`} />
                  <span>
                    {isSending
                      ? "Broadcasting Campaign..."
                      : `Send to ${validCount} Recipient${validCount === 1 ? "" : "s"}`}
                  </span>
                </button>
              </div>
            ) : (
              /* Live Preview Mode */
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>
                    Previewing personalized output for:{" "}
                    <strong className="text-indigo-300">{previewRecipient.name}</strong> (
                    {previewRecipient.email})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[11px]">
                    Preview Mode
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/80 shadow-inner space-y-4">
                  <div className="border-b border-slate-800 pb-3">
                    <div className="text-xs text-slate-500 mb-1">Subject:</div>
                    <div className="text-base font-semibold text-slate-100">
                      {previewSubject || <span className="italic text-slate-600">No subject entered</span>}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-2">Message:</div>
                    <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {previewBody || <span className="italic text-slate-600">No message body entered</span>}
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 flex items-center space-x-2">
                      <FiPaperclip className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{attachments.length} attachment(s) included</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("compose")}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Return to Editor
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Recipient Manager & Campaign Results (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Recipient Source Tabs */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold font-heading text-white mb-4">
              Add Recipients
            </h2>

            {/* Mode selection buttons */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900/60 rounded-xl border border-slate-800 mb-5">
              <button
                onClick={() => setInputMode("file")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                  inputMode === "file"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FiUpload className="h-3.5 w-3.5" />
                <span>Upload</span>
              </button>

              <button
                onClick={() => setInputMode("lists")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                  inputMode === "lists"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FiList className="h-3.5 w-3.5" />
                <span>My Lists</span>
              </button>

              <button
                onClick={() => setInputMode("manual")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                  inputMode === "manual"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FiEdit3 className="h-3.5 w-3.5" />
                <span>Paste</span>
              </button>
            </div>

            {/* Mode 1: File Upload */}
            {inputMode === "file" && (
              <div className="space-y-3">
                <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-900/30 group">
                  <FiUpload className="h-8 w-8 text-indigo-400 group-hover:scale-110 transition-transform mb-2" />
                  <span className="text-sm font-semibold text-slate-200">
                    Click to upload Excel or CSV
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Accepts .xlsx, .xls, and .csv files
                  </span>
                  <span className="text-[11px] text-indigo-400/80 mt-2 font-mono">
                    Expects "Email" & optional "Name" columns
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Mode 2: Saved Lists */}
            {inputMode === "lists" && (
              <div className="space-y-3">
                {loadingLists ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Loading your saved lists...
                  </div>
                ) : savedLists.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
                    No saved lists found. Create your first list in the{" "}
                    <a href="/lists" className="text-indigo-400 underline">
                      Lists tab
                    </a>
                    .
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs text-slate-400">
                      Choose from your email lists:
                    </label>
                    <select
                      value={selectedListId}
                      onChange={(e) => handleLoadList(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl glass-input text-xs"
                    >
                      <option value="">-- Select a List to Load --</option>
                      {savedLists.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.listName} ({l.emails?.length || 0} emails)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Manual / Bulk Paste */}
            {inputMode === "manual" && (
              <div className="space-y-3">
                <textarea
                  rows={4}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Paste emails separated by commas or line breaks:
john@example.com
Jane Doe <jane@example.com>"
                  className="w-full p-3 rounded-xl glass-input text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleParseManual}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Parse & Add Emails
                </button>
              </div>
            )}
          </div>

          {/* Recipient Roster & Statistics */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <FiUserCheck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold font-heading text-white">
                  Recipient Roster
                </h3>
              </div>

              {/* Statistics Badges */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-medium">
                    {invalidCount} invalid
                  </span>
                )}
              </div>
            </div>

            {/* Clean up buttons */}
            {recipients.length > 0 && (
              <div className="flex items-center justify-between gap-2 mb-3">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter recipients..."
                  className="flex-1 px-3 py-1.5 rounded-lg glass-input text-xs"
                />
                <button
                  type="button"
                  onClick={removeDuplicates}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-slate-800 border border-slate-700"
                  title="Remove duplicate emails"
                >
                  Dedup
                </button>
                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={removeInvalid}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-rose-300 hover:text-rose-100 bg-rose-500/20 border border-rose-500/30"
                    title="Remove all invalid emails"
                  >
                    Prune
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRecipients([])}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-800"
                  title="Clear all recipients"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Recipient list container */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {filteredRecipients.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {recipients.length === 0
                    ? "No recipients added yet. Upload a file, pick a list, or paste emails above."
                    : "No recipients match your filter."}
                </div>
              ) : (
                filteredRecipients.map((r, idx) => {
                  const isValid = validateEmail(r.email);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/80 text-xs transition"
                    >
                      <div className="flex items-center space-x-2 truncate pr-2">
                        <span
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            isValid ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        />
                        <span className="font-medium text-slate-200 truncate">
                          {r.name}
                        </span>
                        <span className="text-slate-400 truncate font-mono text-[11px]">
                          ({r.email})
                        </span>
                      </div>
                      <button
                        onClick={() => removeRecipient(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Remove recipient"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Sending Progress Card */}
          {isSending && (
            <div className="card-surface rounded-2xl p-6 border border-slate-700 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold font-heading text-white">
                  Broadcasting Campaign...
                </span>
                <span className="text-xs font-mono text-indigo-400 font-bold">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {currentProgressInfo && (
                <div className="text-xs text-slate-300 flex items-center justify-between">
                  <span className="truncate max-w-[200px]">
                    Current: {currentProgressInfo.email}
                  </span>
                  <span className="font-mono text-slate-400">
                    {currentProgressInfo.index} / {currentProgressInfo.total}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Campaign Complete Report Card */}
          {campaignResults && (
            <div className="glass-card rounded-2xl p-6 border-emerald-500/30">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <FiCheckCircle className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-bold font-heading text-white">
                    Delivery Report
                  </h3>
                </div>

                <button
                  onClick={exportResultsToCsv}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
                >
                  <FiDownload className="h-3.5 w-3.5" />
                  <span>Download Report</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Total</div>
                  <div className="text-lg font-bold font-mono text-white">
                    {campaignResults.total}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="text-xs text-emerald-400">Sent</div>
                  <div className="text-lg font-bold font-mono text-emerald-300">
                    {campaignResults.sent}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <div className="text-xs text-rose-400">Failed</div>
                  <div className="text-lg font-bold font-mono text-rose-300">
                    {campaignResults.failed}
                  </div>
                </div>
              </div>

              {campaignResults.details && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {campaignResults.details.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/80 text-xs flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <span className="text-slate-200 font-medium">{item.email}</span>
                        {item.error && (
                          <div className="text-[11px] text-rose-400 truncate">
                            {item.error}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          item.status === "sent"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Body;
