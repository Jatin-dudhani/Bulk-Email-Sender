const url1 = "https://bulk-email-backend-dx5l.onrender.com";
const url2 = "http://localhost:5000";
export const BASE_URL = url2;
export const API_ENDPOINTS = {
  SEND_EMAILS: `${BASE_URL}/send-emails`,
  VERIFY_SENDER: `${BASE_URL}/verify-sender`,
  GRANT_ACCESS: `${BASE_URL}/grant-access`,
  REVOKE_ACCESS: `${BASE_URL}/revoke-access`,
  TOGGLE_ADMIN: `${BASE_URL}/toggle-admin`,
  AUTHORIZED_USERS: `${BASE_URL}/authorized-users`,
  EMAIL_LISTS: `${BASE_URL}/api/lists`,
};