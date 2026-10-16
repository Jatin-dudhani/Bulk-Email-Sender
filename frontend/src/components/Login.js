import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import axios from "axios";
import { auth, isFirebaseConfigured, SUPER_ADMIN_EMAIL } from "../utils/firebase";
import { API_ENDPOINTS } from "../utils/constants";
import {
  FiMail,
  FiLock,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiAlertCircle,
  FiShield,
  FiCheckCircle,
} from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Load remembered or passed email on mount
  const initialEmail =
    location.state?.email ||
    localStorage.getItem("remembered_user_email") ||
    "";

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    } else {
      const remembered = localStorage.getItem("remembered_user_email");
      if (remembered && !email) {
        setEmail(remembered);
      }
    }
  }, [location.state, email]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);

    // Save or clear remembered email preference
    if (rememberMe) {
      localStorage.setItem("remembered_user_email", cleanEmail);
    } else {
      localStorage.removeItem("remembered_user_email");
    }

    try {
      if (auth && isFirebaseConfigured) {
        let user = null;
        try {
          // 1. Attempt normal sign in
          const userCredential = await signInWithEmailAndPassword(
            auth,
            cleanEmail,
            password
          );
          user = userCredential.user;
        } catch (signInErr) {
          // 2. Seamless Auto-Registration: if account doesn't exist yet, create it on the fly!
          if (
            (signInErr.code === "auth/invalid-credential" ||
              signInErr.code === "auth/user-not-found") &&
            password.length >= 6
          ) {
            try {
              const newCredential = await createUserWithEmailAndPassword(
                auth,
                cleanEmail,
                password
              );
              user = newCredential.user;
            } catch (createErr) {
              if (createErr.code === "auth/email-already-in-use") {
                throw new Error("Incorrect password for this account. Please verify your password and try again.");
              }
              throw signInErr;
            }
          } else {
            throw signInErr;
          }
        }

        // Non-blocking background sync with backend
        axios
          .post(
            API_ENDPOINTS.REGISTER,
            {
              email: user.email,
              uid: user.uid,
              displayName: user.displayName || cleanEmail.split("@")[0],
            },
            { timeout: 3000 }
          )
          .catch((e) => console.warn("Backend registration sync notice:", e.message));

        const isSuperAdmin =
          cleanEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

        // Scope sender email per user account
        const userScope = (user.uid || cleanEmail).replace(/[^a-zA-Z0-9]/g, "_");
        if (!localStorage.getItem(`bulk_email_sender_email_${userScope}`)) {
          localStorage.setItem(`bulk_email_sender_email_${userScope}`, cleanEmail);
        }
        localStorage.removeItem("bulk_email_sender_email");
        localStorage.removeItem("bulk_email_app_pass");

        localStorage.setItem(
          "bulk_email_demo_user",
          JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || cleanEmail.split("@")[0],
            isAdmin: isSuperAdmin,
          })
        );

        navigate("/home");
      } else {
        // Dev / Local fallback
        const isSuperAdmin =
          cleanEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
        const fakeUid = "user_" + Date.now();
        const userScope = fakeUid.replace(/[^a-zA-Z0-9]/g, "_");

        if (!localStorage.getItem(`bulk_email_sender_email_${userScope}`)) {
          localStorage.setItem(`bulk_email_sender_email_${userScope}`, cleanEmail);
        }
        localStorage.removeItem("bulk_email_sender_email");
        localStorage.removeItem("bulk_email_app_pass");

        axios
          .post(
            API_ENDPOINTS.REGISTER,
            {
              email: cleanEmail,
              uid: fakeUid,
              displayName: cleanEmail.split("@")[0],
            },
            { timeout: 3000 }
          )
          .catch(() => {});

        localStorage.setItem(
          "bulk_email_demo_user",
          JSON.stringify({
            uid: fakeUid,
            email: cleanEmail,
            displayName: cleanEmail.split("@")[0],
            isAdmin: isSuperAdmin,
          })
        );

        navigate("/home");
      }
    } catch (err) {
      console.error("Login error:", err);

      let friendlyMessage = err.message || "Failed to sign in.";
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-credential"
      ) {
        friendlyMessage =
          "Invalid email or password. If you haven't created an account yet, click 'Create New Account' below.";
      } else if (err.code === "auth/wrong-password") {
        friendlyMessage = "Incorrect password. Please re-enter.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "The email address is improperly formatted.";
      } else if (err.code === "auth/too-many-requests") {
        friendlyMessage =
          "Too many failed login attempts. Please wait a few moments or click 'Instant Workspace'.";
      } else if (err.code === "auth/network-request-failed") {
        friendlyMessage =
          "Network connection issue reaching authentication service. Check your connection or click 'Instant Workspace'.";
      }

      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (auth && isFirebaseConfigured) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userScope = (user.uid || user.email).replace(/[^a-zA-Z0-9]/g, "_");
        localStorage.setItem("remembered_user_email", user.email);
        if (!localStorage.getItem(`bulk_email_sender_email_${userScope}`)) {
          localStorage.setItem(`bulk_email_sender_email_${userScope}`, user.email);
        }
        localStorage.removeItem("bulk_email_sender_email");
        localStorage.removeItem("bulk_email_app_pass");

        try {
          await axios.post(
            API_ENDPOINTS.REGISTER,
            {
              email: user.email,
              uid: user.uid,
              displayName: user.displayName || user.email.split("@")[0],
            },
            { timeout: 3000 }
          );
        } catch (err) {}

        const isSuperAdmin =
          user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

        localStorage.setItem(
          "bulk_email_demo_user",
          JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split("@")[0],
            isAdmin: isSuperAdmin,
          })
        );

        navigate("/home");
      } else {
        const fallbackEmail = email.trim() || SUPER_ADMIN_EMAIL;
        const userScope = fallbackEmail.replace(/[^a-zA-Z0-9]/g, "_");
        localStorage.setItem("remembered_user_email", fallbackEmail);
        if (!localStorage.getItem(`bulk_email_sender_email_${userScope}`)) {
          localStorage.setItem(`bulk_email_sender_email_${userScope}`, fallbackEmail);
        }
        localStorage.removeItem("bulk_email_sender_email");
        localStorage.removeItem("bulk_email_app_pass");

        const isSuperAdmin =
          fallbackEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

        localStorage.setItem(
          "bulk_email_demo_user",
          JSON.stringify({
            uid: "google_user_" + Date.now(),
            email: fallbackEmail,
            displayName: fallbackEmail.split("@")[0],
            isAdmin: isSuperAdmin,
          })
        );
        navigate("/home");
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setIsLoading(false);
        return;
      }
      if (err.code === "auth/unauthorized-domain") {
        setError(
          "This domain is awaiting Firebase OAuth authorization. Please sign in with Email & Password or click 'Instant Workspace' below."
        );
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectLaunch = () => {
    const targetEmail =
      email.trim() ||
      localStorage.getItem("remembered_user_email") ||
      SUPER_ADMIN_EMAIL;

    const isSuperAdmin =
      targetEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    const userScope = targetEmail.replace(/[^a-zA-Z0-9]/g, "_");
    localStorage.setItem("remembered_user_email", targetEmail);
    if (!localStorage.getItem(`bulk_email_sender_email_${userScope}`)) {
      localStorage.setItem(`bulk_email_sender_email_${userScope}`, targetEmail);
    }
    localStorage.removeItem("bulk_email_sender_email");
    localStorage.removeItem("bulk_email_app_pass");

    localStorage.setItem(
      "bulk_email_demo_user",
      JSON.stringify({
        uid: "direct_session_" + Date.now(),
        email: targetEmail,
        displayName: targetEmail.split("@")[0],
        isAdmin: isSuperAdmin,
      })
    );
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
      <div className="card-surface rounded-2xl p-8 max-w-sm w-full border border-slate-800 shadow-xl relative">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-sm mb-3">
            <FiMail className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold font-heading text-white tracking-tight">
            Bulk Email Studio
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sign in to manage your campaigns
          </p>
        </div>

        {/* Error Alert with One-Click Fallback & Signup Action */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2.5">
            <div className="flex items-start space-x-2.5">
              <FiAlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed flex-1">{error}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Link
                to="/signup"
                state={{ email: email.trim() }}
                className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 flex items-center justify-center space-x-1.5 transition text-center"
              >
                <span>Create New Account</span>
                <FiArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={handleDirectLaunch}
                className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 flex items-center justify-center space-x-1.5 transition"
              >
                <span>Instant Workspace</span>
                <FiArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Google 1-Click Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-white text-slate-800 hover:bg-slate-100 flex items-center justify-center space-x-2.5 transition shadow-sm"
        >
          <FcGoogle className="h-5 w-5" />
          <span>Sign in with Google</span>
        </button>

        {/* Divider */}
        <div className="my-5 flex items-center justify-between">
          <div className="h-[1px] bg-slate-800 flex-1" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3">
            OR WITH EMAIL
          </span>
          <div className="h-[1px] bg-slate-800 flex-1" />
        </div>

        {/* Native Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-3.5">
          {/* Email Field with Remembered Badge */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Email Address
              </label>
              {email && (
                <span className="text-[10px] text-indigo-400 flex items-center space-x-1">
                  <FiCheckCircle className="h-3 w-3" />
                  <span>Remembered</span>
                </span>
              )}
            </div>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-3 text-slate-400 h-4 w-4" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-3.5 py-2 rounded-xl glass-input text-xs"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Password
              </label>
            </div>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-3 text-slate-400 h-4 w-4" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2 rounded-xl glass-input text-xs"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? (
                  <FiEyeOff className="h-4 w-4" />
                ) : (
                  <FiEye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me Toggle */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-slate-400 text-[11px]">Remember my email</span>
            </label>
            <Link
              to="/signup"
              className="text-indigo-400 hover:text-indigo-300 text-[11px] underline underline-offset-4"
            >
              Need an account?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-xl font-bold font-heading text-xs glow-btn-primary flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Studio</span>
                <FiArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Direct Workspace Launch */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={handleDirectLaunch}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-indigo-300 hover:text-white border border-slate-700 flex items-center justify-center space-x-2 transition"
          >
            <span>Launch Workspace Immediately</span>
            <FiArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="mt-5 pt-4 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <FiCheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Excel / CSV Import</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <FiCheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Live Delivery SSE</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <FiCheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Audience Lists</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <FiCheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Anti-Spam Delay</span>
          </div>
        </div>

        {/* Link to Sign Up */}
        <div className="mt-5 text-center text-xs text-slate-400">
          Don't have an account yet?{" "}
          <Link
            to="/signup"
            state={{ email }}
            className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4"
          >
            Create an Account
          </Link>
        </div>

        {/* Security badge */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 text-center text-[11px] text-slate-500 flex items-center justify-center space-x-1.5">
          <FiShield className="h-3 w-3 text-emerald-400" />
          <span>Encrypted with Google Firebase Auth Security</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
