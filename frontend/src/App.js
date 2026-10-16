import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Signup from "./components/Signup";
import Home from "./components/Home";
import Terms from "./components/Terms";
import Privacy from "./components/Privacy";
import Unauthorized from "./components/Unauthorized";
import AdminRoute from "./components/AdminRoute";
import AdminPanel from "./components/AdminPanel";
import Lists from "./components/Lists";
import ProtectedRoute from "./components/ProtectedRoute";
import EmailSettings from "./components/EmailSetting";

// One-time startup migration: purge dangerous legacy shared keys from browser
try {
  localStorage.removeItem("bulk_email_app_pass");
  localStorage.removeItem("bulk_email_sender_email");
} catch (e) {}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/home",
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
  },
  {
    path: "/lists",
    element: (
      <ProtectedRoute>
        <Lists />
      </ProtectedRoute>
    ),
  },
  {
    path: "/email-settings",
    element: (
      <ProtectedRoute>
        <EmailSettings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <AdminRoute>
          <AdminPanel />
        </AdminRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: "/terms",
    element: <Terms />,
  },
  {
    path: "/privacy",
    element: <Privacy />,
  },
  {
    path: "/unauthorized",
    element: <Unauthorized />,
  },
  {
    path: "*",
    element: <Navigate to="/home" replace />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;