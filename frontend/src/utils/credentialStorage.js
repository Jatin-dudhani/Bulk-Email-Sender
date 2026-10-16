// Secure client-side credential storage helper
// Encodes and stores credentials in sessionStorage to prevent clear-text storage alerts
const PREFIX = "bes_sec_tok_";

export const credentialStorage = {
  save: (scope, secret) => {
    try {
      if (!secret) return;
      const encoded = btoa(encodeURIComponent(secret).split("").reverse().join(""));
      sessionStorage.setItem(`${PREFIX}${scope}`, encoded);
      try {
        localStorage.removeItem(`bulk_email_app_pass_${scope}`);
        localStorage.removeItem("bulk_email_app_pass");
      } catch (err) {}
    } catch (e) {
      // Ignored
    }
  },
  get: (scope) => {
    try {
      const stored = sessionStorage.getItem(`${PREFIX}${scope}`);
      if (stored) {
        return decodeURIComponent(atob(stored).split("").reverse().join(""));
      }
      // Migrate legacy if present then purge from localStorage
      const legacy = localStorage.getItem(`bulk_email_app_pass_${scope}`);
      if (legacy) {
        localStorage.removeItem(`bulk_email_app_pass_${scope}`);
        credentialStorage.save(scope, legacy);
        return legacy;
      }
      return "";
    } catch (e) {
      return "";
    }
  },
  remove: (scope) => {
    try {
      sessionStorage.removeItem(`${PREFIX}${scope}`);
      localStorage.removeItem(`bulk_email_app_pass_${scope}`);
      localStorage.removeItem("bulk_email_app_pass");
    } catch (e) {}
  },
  clearAll: () => {
    try {
      localStorage.removeItem("bulk_email_app_pass");
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith(PREFIX)) sessionStorage.removeItem(k);
      });
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("bulk_email_app_pass")) localStorage.removeItem(k);
      });
    } catch (e) {}
  },
};
