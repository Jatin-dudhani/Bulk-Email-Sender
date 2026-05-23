import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, onIdTokenChanged } from "firebase/auth";
import { app } from "../utils/firebase";
import { Link, useLocation, useNavigate } from "react-router-dom";

const Header = () => {
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPage = location.pathname === "/admin";

  useEffect(() => {
    const auth = getAuth(app);
    
    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserData(user);
      }
    });

    // Poll for token changes every 5 seconds
  const tokenCheckInterval = setInterval(async () => {
    const user = auth.currentUser;
    if (user) {
      const tokenResult = await user.getIdTokenResult(true);
      const newAdminStatus = !!tokenResult.claims.admin;
      const isAuthorized = !!tokenResult.claims.authorized;
      setIsAdmin(newAdminStatus);
      
      if (!isAuthorized) {
        auth.signOut();
      } else if (!newAdminStatus && location.pathname === '/admin') {
        navigate('/home', { replace: true });
      }
    }
  }, 5000);

    // Listen for token changes (including claims)
    const unsubscribeToken = onIdTokenChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await user.getIdTokenResult(true);
        const newAdminStatus = !!tokenResult.claims.admin;
      setIsAdmin(newAdminStatus);
        // Redirect if admin access is revoked while on admin panel
        if (!newAdminStatus && location.pathname === '/admin') {
          navigate('/home', { replace: true });
        }
      }
    });
    
    return () => {
      unsubscribeAuth();
      unsubscribeToken();
      clearInterval(tokenCheckInterval);
    };
  }, [location.pathname, navigate]);

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
      {/* <nav className="header-animated-gradient shadow-lg backdrop-blur-sm bg-opacity-80"></nav> */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <span className="text-white text-2xl font-bold">
              Bulk Email Sender
            </span>
          </div>
          <Link
  to="/lists"
  className="text-white hover:text-blue-200 transition-colors font-medium mr-4"
>
  Lists
          </Link>
          <Link
  to="/email-settings"
  className="text-white hover:text-blue-200 transition-colors font-medium mr-4"
>
  Email Settings
</Link>


          {userData && (
            <div className="flex items-center space-x-4">
              {isAdmin && (
                <Link
                  to={isAdminPage ? "/home" : "/admin"}
                  className="text-white hover:text-blue-200 transition-colors font-medium"
                >
                  {isAdminPage ? "Home" : "Admin Panel"}
                </Link>
              )}
              <div className="flex items-center">
                <div className="text-right mr-4">
                  <div className="text-white font-medium">
                    {userData.displayName}
                  </div>
                  <div className="text-blue-100 text-sm">{userData.email}</div>
                </div>
                <img
                  src={userData.photoURL}
                  alt="Profile"
                  className="h-12 w-12 rounded-full border-2 border-white shadow-md hover:border-blue-200 transition-all"
                />
              </div>
              <button
                onClick={() => getAuth(app).signOut()}
                className="bg-white text-blue-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Header;
