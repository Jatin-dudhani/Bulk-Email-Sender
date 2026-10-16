import React from "react";
import { Link } from "react-router-dom";
import Header from "./Header";
import { FiArrowLeft, FiFileText } from "react-icons/fi";

const Terms = () => {
  return (
    <div className="min-h-screen bg-[#090d16]">
      <Header />
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="card-surface rounded-2xl p-8 sm:p-10 space-y-6 text-slate-300 border border-slate-800">
          <div className="flex items-center justify-between pb-6 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700/60">
                <FiFileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-heading text-white">Terms of Service</h1>
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
            <h2 className="text-lg font-semibold text-white">1. Acceptable Email Sending Policy</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Bulk Email Sender is designed for legitimate communication, newsletters, transactional notifications,
              and customer updates. Users must have explicit permission or consent before sending emails to any recipient.
              Sending unsolicited bulk email (SPAM), deceptive phishing messages, or malware is strictly prohibited.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">2. Sender Credentials & Authentication</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Users provide their own Gmail SMTP credentials (such as Google App Passwords) for mail dispatch.
              You are responsible for safeguarding your credentials. We do not store your App Passwords on external servers;
              credentials operate strictly in your session or within local browser storage as requested.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">3. Compliance with Anti-Spam Laws</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              You agree to comply with all relevant international email regulations, including the CAN-SPAM Act,
              GDPR, and CASL. You agree to include accurate sender identity information and fulfill opt-out requests.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">4. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              The service is provided "as is" without warranty of any kind. We are not liable for account suspensions,
              email delivery failures, spam-folder placement, or third-party service interruptions caused by email providers.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;