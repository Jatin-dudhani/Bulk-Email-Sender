// Dynamic API Base URL resolution:
// 1. User-configured custom backend URL in browser settings
// 2. Localhost fallback (port 5001)
// 3. Environment variable REACT_APP_API_URL
// 4. Fallback production backend
export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("bulk_email_custom_backend_url");
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, "");
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:5001";
    }
  }

  if (
    process.env.REACT_APP_API_URL &&
    !process.env.REACT_APP_API_URL.includes("localhost") &&
    !process.env.REACT_APP_API_URL.includes("127.0.0.1")
  ) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/, "");
  }

  return process.env.REACT_APP_PROD_API_URL || "https://bulk-email-backend-dx5l.onrender.com";
};

export const BASE_URL = getBaseUrl();

export const API_ENDPOINTS = {
  get STATUS() { return `${getBaseUrl()}/api/status`; },
  get HEALTH() { return `${getBaseUrl()}/health`; },
  get SEND_EMAILS() { return `${getBaseUrl()}/send-emails`; },
  get SEND_PROGRESS() { return `${getBaseUrl()}/send-emails/progress`; },
  get VERIFY_SENDER() { return `${getBaseUrl()}/verify-sender`; },
  get TEST_EMAIL() { return `${getBaseUrl()}/api/test-email`; },
  get GRANT_ACCESS() { return `${getBaseUrl()}/grant-access`; },
  get REVOKE_ACCESS() { return `${getBaseUrl()}/revoke-access`; },
  get TOGGLE_ADMIN() { return `${getBaseUrl()}/toggle-admin`; },
  get AUTHORIZED_USERS() { return `${getBaseUrl()}/authorized-users`; },
  get EMAIL_LISTS() { return `${getBaseUrl()}/api/lists`; },
  get REGISTER() { return `${getBaseUrl()}/api/auth/register`; },
};