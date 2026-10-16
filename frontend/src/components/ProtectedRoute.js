import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app, isFirebaseConfigured } from "../utils/firebase";

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if demo user session exists
    const demoUser = localStorage.getItem("bulk_email_demo_user");
    if (demoUser || !isFirebaseConfigured) {
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    let auth = null;
    try {
      auth = getAuth(app);
    } catch (e) {
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        const localSession = localStorage.getItem("bulk_email_demo_user");
        setIsAuthenticated(!!localSession);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;