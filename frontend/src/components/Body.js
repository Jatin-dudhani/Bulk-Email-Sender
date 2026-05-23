import React, { useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { API_ENDPOINTS } from "../utils/constants.js";

function validateEmail(email) {
  const regex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
  return regex.test(email);
}

const Body = () => {
  const [recipients, setRecipients] = useState([]);
  const [validRecipients, setValidRecipients] = useState([]);
  const [invalidRecipients, setInvalidRecipients] = useState([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [progress, setProgress] = useState(0);

  const handleTextAreaChange = (e) => {
    const textarea = e.target;
    setBody(e.target.value);

    // Reset height to auto to properly calculate scroll height
    textarea.style.height = "auto";
    // Set new height based on content
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(files);
  };

  const handleSendEmails = async () => {
    const valid = recipients.filter((recipient) =>
      validateEmail(recipient.email)
    );
    const invalid = recipients.filter(
      (recipient) => !validateEmail(recipient.email)
    );

    setValidRecipients(valid);
    setInvalidRecipients(invalid);
    setIsSending(true);
    setProgress(0);
    let eventSource;
    try {
      const formData = new FormData();
      formData.append("valid", JSON.stringify(valid));
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("senderEmail", senderEmail);
      formData.append("appPassword", appPassword);

      attachments.forEach((file) => {
        formData.append("attachments", file);
      });

      // Calculate progress increment per email
      const progressIncrement = 100 / valid.length;

      // Subscribe to progress events
      eventSource = new EventSource(`${API_ENDPOINTS.SEND_EMAILS}/progress`);
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setCurrentEmail(data.email);
        setProgress((prev) => prev + progressIncrement);
      };

      await axios.post(API_ENDPOINTS.SEND_EMAILS, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      eventSource.close();
      setProgress(100);

      setTimeout(() => {
        setIsSending(false);
        setCurrentEmail("");
        setProgress(0);
      }, 5000);
    } catch (error) {
      console.error("Error:", error);
      eventSource?.close();
      setIsSending(false);
      setCurrentEmail("");
      setProgress(0);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
    ];

    if (!allowedTypes.includes(file?.type)) {
      alert("Please upload only Excel files (.xlsx or .xls)");
      e.target.value = ""; // Clear the input
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const processedRecipients = jsonData.map((row) => ({
        name: row.Name || row.name || row["Full Name"] || "",
        email: row.Email || row.email || row["Email Address"] || "",
      }));

      setRecipients(processedRecipients);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen main-animated-gradient">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Bulk Email Sender
        </h1>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">Sender Credentials</h2>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Sender Email</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">App Password</label>
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
                <p className="mt-2 text-sm text-gray-600">
                  To generate an app password: <br />
                  1. Enable 2-Step Verification in your Google Account <br />
                  2. Go to "Manage Your Google Account" and search for "App
                  Passwords" <br />
                  3. Create a new app password with any name of your choice{" "}
                  <br />
                  4. Copy the generated password immediately as it will only be
                  shown once <br />
                  5. After using it on our website, you can safely delete this
                  app password from your Google Account
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (Use {name} for personalization)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Body
              </label>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 min-h-[72px]" // min-h-[72px] gives approximately 3 lines
                rows="3"
                value={body}
                onChange={handleTextAreaChange}
                placeholder="Email body (Use {name} for personalization)"
                style={{ resize: "none", overflow: "hidden" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Excel File (<span className="font-bold">Name</span> and{" "}
                <span className="font-bold">Email</span> columns)
              </label>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments
              </label>
              <input
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />
              {attachments.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Selected files:</p>
                  <ul className="list-disc pl-5">
                    {attachments.map((file, index) => (
                      <li key={index} className="text-sm text-gray-600">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={handleSendEmails}
              disabled={isSending}
              className={`w-full py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isSending
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isSending ? "Sending..." : "Send Emails"}
            </button>
          </div>
        </div>
        {isSending && (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Sending Emails...
              </h3>
              {currentEmail && (
                <p className="text-sm text-gray-600 mt-2">
                  Sending email to: {currentEmail}
                </p>
              )}
            </div>
            <div className="relative pt-1">
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                <div
                  style={{ width: `${progress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
                />
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold inline-block text-blue-600">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
            Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4">
                Valid Recipients
              </h3>
              <ul className="space-y-2">
                {validRecipients.length > 0 ? (
                  validRecipients.map((recipient, index) => (
                    <li key={index} className="text-gray-600">
                      {recipient.name} ({recipient.email})
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">No valid recipients found</li>
                )}
              </ul>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4">
                Invalid Recipients
              </h3>
              <ul className="space-y-2">
                {invalidRecipients.length > 0 ? (
                  invalidRecipients.map((recipient, index) => (
                    <li key={index} className="text-gray-600">
                      {recipient.name} ({recipient.email})
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">No invalid recipients found</li>
                )}
              </ul>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4">Failed Emails</h3>
              <ul className="space-y-2">
                <li className="text-gray-500">No failed emails</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-gray-700 text-lg leading-relaxed">
            Please note: This application uses Render's free tier services,
            which may require a 10-second initialization period during the first
            interaction due to automatic shutdown after inactivity.
            <br />
            <br />
            The user interface is currently under development and will be
            enhanced in future updates.
            <br />
            <br />
            Your feedback is valuable! Feel free to share your thoughts at{" "}
            <a
              href="mailto:jatindudhani07@gmail.com"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              jatindudhani07@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Body;
