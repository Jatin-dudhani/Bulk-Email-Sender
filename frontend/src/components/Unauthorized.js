import React from "react";
import { useNavigate } from "react-router-dom";
import { FiShieldOff, FiMail, FiArrowLeft, FiHelpCircle } from "react-icons/fi";

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
      <div className="card-surface rounded-2xl p-8 max-w-sm w-full border border-slate-800 text-center">
        <div className="h-12 w-12 rounded-xl bg-slate-800 text-rose-400 border border-slate-700 mx-auto flex items-center justify-center mb-5">
          <FiShieldOff className="h-6 w-6" />
        </div>

        <h1 className="text-xl font-bold font-heading text-white mb-2">
          Access Restricted
        </h1>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Your account is currently not authorized to access this workspace. Please contact
          the system administrator to be granted access.
        </p>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-left space-y-2 mb-6 text-xs text-slate-300">
          <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
            <FiHelpCircle className="h-3.5 w-3.5 text-slate-400" />
            <span>Administrator Contact</span>
          </div>
          <div className="flex items-center space-x-2 text-indigo-400 font-mono text-[11px]">
            <FiMail className="h-3.5 w-3.5" />
            <a href="mailto:jatindudhani07@gmail.com" className="hover:underline">
              jatindudhani07@gmail.com
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate("/")}
            className="w-full py-2.5 rounded-lg text-xs font-semibold btn-primary flex items-center justify-center space-x-2"
          >
            <FiArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Login</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;