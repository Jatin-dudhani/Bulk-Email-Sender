import React, { useState, useEffect } from "react";
import axios from "axios";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Header from "./Header";
import { app } from "../utils/firebase";
import { API_ENDPOINTS, getBaseUrl } from "../utils/constants";
import {
  FiMail,
  FiKey,
  FiCheckCircle,
  FiAlertCircle,
  FiHelpCircle,
  FiSave,
  FiSend,
  FiShield,
  FiExternalLink,
  FiServer,
  FiActivity,
  FiRefreshCw,
} from "react-icons/fi";

const EmailSettings = () => {
  const [senderEmail, setSenderEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }
  const [isSaved, setIsSaved] = useState(false);

  // Backend API URL configuration state
  const [customBackendUrl, setCustomBackendUrl] = useState(() => {
    return localStorage.getItem("bulk_email_custom_backend_url") || getBaseUrl();
  });
  const [backendTestStatus, setBackendTestStatus] = useState(null);
  const [isTestingBackend, setIsTestingBackend] = useState(false);

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

  useEffect(() => {
    localStorage.removeItem("bulk_email_app_pass");
    localStorage.removeItem("bulk_email_sender_email");

    const loadCredentialsForUser = (userEmail, userUid) => {
      const scope = (userUid || userEmail || "guest").replace(/[^a-zA-Z0-9]/g, "_");
      const savedEmail = localStorage.getItem(`bulk_email_sender_email_${scope}`);
      const savedPass = localStorage.getItem(`bulk_email_app_pass_${scope}`);

      setSenderEmail(savedEmail || userEmail || "");
      setAppPassword(savedPass || "");
    };

    let auth = null;
    try {
      auth = getAuth(app);
    } catch (e) {}

    let unsubscribe = () => {};
    if (auth) {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          loadCredentialsForUser(user.email, user.uid);
        } else {
          const demoUser = localStorage.getItem("bulk_email_demo_user");
          if (demoUser) {
            try {
              const parsed = JSON.parse(demoUser);
              loadCredentialsForUser(parsed.email, parsed.uid);
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
      const demoUser = localStorage.getItem("bulk_email_demo_user");
      if (demoUser) {
        try {
          const parsed = JSON.parse(demoUser);
          loadCredentialsForUser(parsed.email, parsed.uid);
        } catch (err) {}
      }
    }

    return () => unsubscribe();
  }, []);

  const handleSaveCredentials = () => {
    if (!senderEmail || !appPassword) {
      setStatus({ type: "error", message: "Please fill in both sender email and app password." });
      return;
    }
    const scope = getUserScopeKey();
    localStorage.setItem(`bulk_email_sender_email_${scope}`, senderEmail.trim());
    localStorage.setItem(`bulk_email_app_pass_${scope}`, appPassword.trim());
    setIsSaved(true);
    setStatus({ type: "success", message: "Credentials safely saved for your account!" });
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleVerifySMTP = async () => {
    if (!senderEmail || !appPassword) {
      setStatus({ type: "error", message: "Provide both sender email and app password to verify." });
      return;
    }

    setIsVerifying(true);
    setStatus({ type: "info", message: "Contacting Google SMTP server (smtp.gmail.com:465)..." });

    try {
      const response = await axios.post(API_ENDPOINTS.VERIFY_SENDER, {
        senderEmail: senderEmail.trim(),
        appPassword: appPassword.trim(),
      }, { timeout: 6000 });

      if (response.data.success) {
        setStatus({
          type: "success",
          message: `✓ SMTP connection verified! ${response.data.message}`,
        });
        const scope = getUserScopeKey();
        localStorage.setItem(`bulk_email_sender_email_${scope}`, senderEmail.trim());
        localStorage.setItem(`bulk_email_app_pass_${scope}`, appPassword.trim());
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error.response?.data?.error || "SMTP verification failed: " + error.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendTest = async () => {
    if (!senderEmail || !appPassword) {
      setStatus({ type: "error", message: "Please enter your sender email and password first." });
      return;
    }

    setIsSendingTest(true);
    setStatus({ type: "info", message: `Sending sample verification email to ${senderEmail}...` });

    try {
      const response = await axios.post(API_ENDPOINTS.TEST_EMAIL, {
        senderEmail: senderEmail.trim(),
        appPassword: appPassword.trim(),
        testRecipient: senderEmail.trim(),
      }, { timeout: 8000 });

      if (response.data.success) {
        setStatus({
          type: "success",
          message: `✓ Test email delivered to ${senderEmail}! Check your inbox.`,
        });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: "Test email delivery failed: " + (error.response?.data?.error || error.message),
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleTestBackend = async (urlToTest) => {
    const target = (urlToTest || customBackendUrl).trim().replace(/\/+$/, "");
    if (!target) return;
    setIsTestingBackend(true);
    setBackendTestStatus(null);
    const start = Date.now();

    try {
      const res = await axios.get(`${target}/health`, { timeout: 4000 });
      const latency = Date.now() - start;
      setBackendTestStatus({
        success: true,
        message: `✓ Server online (${latency}ms) — Mode: ${res.data?.mode || "Node.js Express"}`,
      });
    } catch (err) {
      setBackendTestStatus({
        success: false,
        message: `Connection failed: ${err.message}. If running locally, check that 'npm run dev:backend' is running on port 5001.`,
      });
    } finally {
      setIsTestingBackend(false);
    }
  };

  const handleSaveBackendUrl = () => {
    const cleaned = customBackendUrl.trim().replace(/\/+$/, "");
    if (cleaned) {
      localStorage.setItem("bulk_email_custom_backend_url", cleaned);
    } else {
      localStorage.removeItem("bulk_email_custom_backend_url");
    }
    setBackendTestStatus({
      success: true,
      message: `Backend endpoint updated to: ${cleaned || "Default"}`,
    });
  };

  const handleResetBackend = () => {
    localStorage.removeItem("bulk_email_custom_backend_url");
    setCustomBackendUrl(getBaseUrl());
    setBackendTestStatus({
      success: true,
      message: "Reset backend to default URL.",
    });
  };

  return (
    <div className="min-h-screen bg-[#090d16]">
      <Header />

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-heading text-white tracking-tight">
            Email & Server Settings
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Configure your SMTP delivery credentials and backend API connectivity.
          </p>
        </div>

        {/* Feedback Alert */}
        {status && (
          <div
            className={`mb-6 p-3.5 rounded-xl flex items-start justify-between border text-xs font-medium ${
              status.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : status.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-slate-800 border-slate-700 text-slate-200"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {status.type === "success" ? (
                <FiCheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              ) : status.type === "error" ? (
                <FiAlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              ) : (
                <div className="h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
            <button
              onClick={() => setStatus(null)}
              className="text-slate-400 hover:text-white ml-4"
            >
              ✕
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Main Credentials Card */}
          <div className="card-surface rounded-2xl p-6 sm:p-8 border border-slate-800">
            <div className="flex items-center space-x-3 pb-4 mb-6 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                <FiMail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold font-heading text-white">
                  Sender Gmail Account
                </h2>
                <p className="text-xs text-slate-400">
                  Your campaigns will be delivered securely from this verified address.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                  Sender Gmail Address
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3.5 top-3 text-slate-400 h-4 w-4" />
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="your.email@gmail.com"
                    className="w-full pl-10 pr-4 py-2 rounded-lg input-surface text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                  16-Character Google App Password
                </label>
                <div className="relative">
                  <FiKey className="absolute left-3.5 top-3 text-slate-400 h-4 w-4" />
                  <input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full pl-10 pr-4 py-2 rounded-lg input-surface text-xs font-mono tracking-wider"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Requires 2-Step Verification enabled. Do NOT use your regular Google account password.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleVerifySMTP}
                  disabled={isVerifying}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold btn-primary"
                >
                  <FiShield className="h-3.5 w-3.5" />
                  <span>{isVerifying ? "Verifying SMTP..." : "Test SMTP Connection"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isSendingTest || !senderEmail || !appPassword}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold btn-secondary"
                >
                  <FiSend className="h-3.5 w-3.5 text-slate-300" />
                  <span>{isSendingTest ? "Sending Test..." : "Send Test to Inbox"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCredentials}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-700/60 hover:bg-emerald-600 text-emerald-100 border border-emerald-600/50 transition"
                >
                  <FiSave className="h-3.5 w-3.5" />
                  <span>{isSaved ? "Saved!" : "Save Credentials"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Backend API Server Endpoint Configuration */}
          <div className="card-surface rounded-2xl p-6 sm:p-8 border border-slate-800">
            <div className="flex items-center space-x-3 pb-4 mb-6 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                <FiServer className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold font-heading text-white">
                  Backend API Server Connection
                </h2>
                <p className="text-xs text-slate-400">
                  Manage the API service responsible for SMTP delivery and recipient processing.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                  Backend API URL
                </label>
                <div className="relative">
                  <FiActivity className="absolute left-3.5 top-3 text-slate-400 h-4 w-4" />
                  <input
                    type="url"
                    value={customBackendUrl}
                    onChange={(e) => setCustomBackendUrl(e.target.value)}
                    placeholder="http://localhost:5001"
                    className="w-full pl-10 pr-4 py-2 rounded-lg input-surface text-xs font-mono"
                  />
                </div>
                <div className="mt-2 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBackendUrl("http://localhost:5001");
                      handleTestBackend("http://localhost:5001");
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-mono transition"
                  >
                    Use Localhost:5001
                  </button>
                  <button
                    type="button"
                    onClick={handleResetBackend}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-[11px] transition"
                  >
                    Reset Default
                  </button>
                </div>
              </div>

              {backendTestStatus && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium ${
                    backendTestStatus.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  {backendTestStatus.message}
                </div>
              )}

              <div className="pt-1 flex space-x-2.5">
                <button
                  type="button"
                  onClick={() => handleTestBackend()}
                  disabled={isTestingBackend}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold btn-secondary"
                >
                  <FiRefreshCw className={`h-3.5 w-3.5 ${isTestingBackend ? "animate-spin" : ""}`} />
                  <span>{isTestingBackend ? "Pinging..." : "Test Server Connection"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveBackendUrl}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold btn-primary"
                >
                  <FiSave className="h-3.5 w-3.5" />
                  <span>Save Server URL</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step-by-Step App Password Guide */}
          <div className="card-surface rounded-2xl p-6 sm:p-8 border border-slate-800">
            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                <FiHelpCircle className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold font-heading text-white">
                How to Generate a Google App Password
              </h3>
            </div>

            <ol className="space-y-2 text-xs text-slate-300 leading-relaxed list-decimal list-inside pl-1">
              <li>
                Ensure <strong className="text-white">2-Step Verification</strong> is active on your
                Google Account.
              </li>
              <li>
                Open the official Google App Passwords settings page:{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline inline-flex items-center space-x-1"
                >
                  <span>Google App Passwords</span>
                  <FiExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Enter an App name (e.g. <span className="font-mono text-slate-300">"Bulk Emailer"</span>)
                and click <strong>Create</strong>.
              </li>
              <li>
                Copy the 16-character generated password (spaces can be included or omitted).
              </li>
              <li>Paste it into the password field above and click "Test SMTP Connection".</li>
            </ol>

            <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center space-x-2.5">
              <FiShield className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span>
                Your credentials are stored exclusively in your local browser and sent over TLS 1.3 to Gmail SMTP.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmailSettings;
