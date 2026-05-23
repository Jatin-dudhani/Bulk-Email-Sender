import React, { useEffect, useState } from "react";
import axios from "axios";
import { getAuth } from "firebase/auth";
import Header from "./Header";
import { FiRefreshCw } from "react-icons/fi";
import { API_ENDPOINTS } from "../utils/constants";

const AdminPanel = () => {
  const [newUserEmail, setNewUserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mainAdminEmail = "parthgarg351@gmail.com";
  const auth = getAuth();

  useEffect(() => {
    fetchAuthorizedUsers();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage("");
      }, 7000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchAuthorizedUsers = async () => {
    setIsRefreshing(true);
    try {
      const response = await axios.get(API_ENDPOINTS.AUTHORIZED_USERS);
      setAuthorizedUsers(response.data.users);
    } catch (error) {
      setMessage(
        "Error fetching users" + (error.response?.data?.error || error.message)
      );
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  const grantAccess = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(newUserEmail)) {
      setMessage("Please enter a valid email address");
      return;
    }
    const requestBody = {
      adminEmail: auth.currentUser.email,
      userEmailToGrant: newUserEmail,
    };
    try {
      const response = await axios.post(
        API_ENDPOINTS.GRANT_ACCESS,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      setMessage("Access granted successfully");
      setNewUserEmail("");
    } catch (error) {
      if (error.response?.data?.error?.includes("no user record")) {
        setMessage(
          "User must sign in with Google at least once before being granted access"
        );
      } else {
        setMessage(error.response?.data?.error || "Error granting access");
      }
    }
  };

  const toggleAdminStatus = async (userEmail) => {
    if (userEmail === mainAdminEmail) {
      setMessage("Cannot modify main admin privileges");
      return;
    }
    try {
      await axios.post(API_ENDPOINTS.TOGGLE_ADMIN, {
        currentAdminEmail: auth.currentUser.email,
        targetUserEmail: userEmail,
      });
      setMessage("Admin status updated successfully");
      fetchAuthorizedUsers();
    } catch (error) {
      setMessage(error.response?.data?.error || "Error updating admin status");
    }
  };

  const revokeAccess = async (userEmail) => {
    try {
      await axios.post(API_ENDPOINTS.REVOKE_ACCESS, {
        adminEmail: auth.currentUser.email,
        userEmailToRevoke: userEmail,
      });
      setMessage("Access revoked successfully");
      fetchAuthorizedUsers();
    } catch (error) {
      setMessage(error.response?.data?.error || "Error revoking access");
    }
  };

  return (
    <div>
      <Header />
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">Grant Access</h2>
            <div className="space-y-4">
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Enter user email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <button
                onClick={grantAccess}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Grant Access
              </button>
            </div>
          </div>
          {message && (
            <div
              className={`mt-4 p-4 mb-4 rounded-md ${
                message.includes("Error")
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {message}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Authorized Users</h2>
              <button
                onClick={fetchAuthorizedUsers}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                disabled={isRefreshing}
              >
                <FiRefreshCw
                  className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {authorizedUsers.map((user) => (
                  <div
                    key={user.email}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-gray-500">
                        {user.isAdmin ? "Admin" : "User"}
                      </p>
                    </div>
                    {user.email !== "parthgarg351@gmail.com" && (
                      <div className="space-x-2">
                        <button
                          onClick={() => toggleAdminStatus(user.email)}
                          className={`px-4 py-2 rounded-md transition-colors ${
                            user.isAdmin
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-green-600 hover:bg-green-700"
                          } text-white`}
                        >
                          {user.isAdmin ? "Remove Admin" : "Make Admin"}
                        </button>
                        <button
                          onClick={() => revokeAccess(user.email)}
                          className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
                        >
                          Revoke Access
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
