import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../utils/firebase";

const AdminRoute = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const superAdminEmail = (process.env.REACT_APP_ADMIN_EMAIL || "jatindudhani07@gmail.com").toLowerCase().trim();

  useEffect(() => {
    let auth = null;
    try {
      auth = getAuth(app);
    } catch (e) {}

    // 1. Check live Firebase Auth if user is signed in
    if (auth && auth.currentUser) {
      const user = auth.currentUser;
      const isSuperAdminEmail = user.email && user.email.toLowerCase().trim() === superAdminEmail;
      user
        .getIdTokenResult()
        .then((idTokenResult) => {
          const adminStatus = !!idTokenResult.claims.admin || isSuperAdminEmail;
          setIsAdmin(adminStatus);
          setLoading(false);
        })
        .catch(() => {
          setIsAdmin(isSuperAdminEmail);
          setLoading(false);
        });
      return;
    }

    // 2. Check local session if in dev / offline mode
    const demoUserStr = localStorage.getItem("bulk_email_demo_user");
    if (demoUserStr) {
      try {
        const demoUser = JSON.parse(demoUserStr);
        const isUserAdmin =
          (demoUser.email && demoUser.email.toLowerCase().trim() === superAdminEmail) ||
          (demoUser.isAdmin === true && demoUser.email && demoUser.email.toLowerCase().trim() === superAdminEmail);
        setIsAdmin(!!isUserAdmin);
        setLoading(false);
        return;
      } catch (err) {}
    }

    // 3. Fallback to Firebase onAuthStateChanged listener
    if (!auth) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          const adminStatus =
            !!idTokenResult.claims.admin ||
            user.email === (process.env.REACT_APP_ADMIN_EMAIL || "jatindudhani07@gmail.com");
          setIsAdmin(adminStatus);
        } catch (e) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [superAdminEmail]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  return isAdmin ? children : <Navigate to="/unauthorized" replace />;
};

export default AdminRoute;