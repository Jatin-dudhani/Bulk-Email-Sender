import React from "react";
import { Link } from "react-router-dom";
import Header from "./Header";
import { FiArrowLeft, FiLock } from "react-icons/fi";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-[#090d16]">
      <Header />
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="card-surface rounded-2xl p-8 sm:p-10 space-y-6 text-slate-300 border border-slate-800">
          <div className="flex items-center justify-between pb-6 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700/60">
                <FiLock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-heading text-white">Privacy Policy</h1>
                <p className="text-xs text-slate-400">Last updated: October 2026</p>
              </div>
            </div>

            <Link
              to="/home"
              className="flex items-center space-x-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700"
            >
              <FiArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">1. Data Collection & Usage</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              We respect your privacy. Any contact lists, uploaded spreadsheets, and recipient emails provided
              within Bulk Email Sender are processed strictly to fulfill email dispatch requests.
              We do not sell, rent, or distribute recipient email lists to any third party.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">2. Storage of Credentials</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Sender credentials and App Passwords are stored in your local browser storage only when you
              explicitly opt-in to remember them. They are transmitted encrypted over HTTPS/SSL directly
              to your designated backend server for Gmail SMTP dispatch.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">3. Third-Party Integrations</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Authentication is optionally handled via Google Firebase Auth. Please review Google's Privacy
              Policy for details regarding Google's user data handling.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">4. Data Deletion</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              You can delete any saved email list or clear local credentials at any time directly through the
              Audience Lists and Email Settings interfaces.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;