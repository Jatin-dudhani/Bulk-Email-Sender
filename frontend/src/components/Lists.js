import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import axios from "axios";
import * as XLSX from "xlsx";
import Header from "./Header";
import { API_ENDPOINTS } from "../utils/constants";

const Lists = () => {
  const [lists, setLists] = useState([]);
  const [expandedLists, setExpandedLists] = useState({});
  const [newListName, setNewListName] = useState("");
  const [selectedList, setSelectedList] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const auth = getAuth();

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    const userId = auth.currentUser.uid;
    const response = await axios.get(`${API_ENDPOINTS.EMAIL_LISTS}/${userId}`);
    setLists(response.data);
  };

  const handleCreateList = async () => {
    if (newListName.trim()) {
      const userId = auth.currentUser.uid;
      await axios.post(API_ENDPOINTS.EMAIL_LISTS, {
        userId,
        listName: newListName,
      });
      fetchLists();
      setNewListName("");
    }
  };

  const handleAddEmail = async (listId) => {
    if (newEmail.trim()) {
      await axios.post(`${API_ENDPOINTS.EMAIL_LISTS}/${listId}/emails`, {
        emails: [newEmail],
      });
      fetchLists();
      setNewEmail("");
    }
  };

  const handleRemoveEmail = async (listId, email) => {
    await axios.delete(
      `${API_ENDPOINTS.EMAIL_LISTS}/${listId}/emails/${email}`
    );
    fetchLists();
  };

  const handleDeleteList = async (listId) => {
    await axios.delete(`${API_ENDPOINTS.EMAIL_LISTS}/${listId}`);
    setShowDeleteModal(false);
    fetchLists();
  };

  const handleFileUpload = async (listId, file) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const emails = XLSX.utils
        .sheet_to_json(worksheet, { header: 1 })
        .map((row) => row[0])
        .filter((email) => email);

      await axios.post(`${API_ENDPOINTS.EMAIL_LISTS}/${listId}/emails`, {
        emails,
      });
      fetchLists();
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen main-animated-gradient">
      <Header />
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-xl p-6">
          {/* List Creation Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Create New List</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Enter list name"
                className="flex-1 px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleCreateList}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                Create List
              </button>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-xl p-6 my-5">
          {/* Lists Display Section */}
          <div className="space-y-6">
            {lists.map((list) => (
              <div key={list._id} className="border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">{list.listName}</h3>
                  <div className="space-x-2">
                    <button
                      onClick={() =>
                        setExpandedLists((prev) => ({
                          ...prev,
                          [list._id]: !prev[list._id],
                        }))
                      }
                      className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-md"
                    >
                      {expandedLists[list._id] ? "Collapse" : "Expand"}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedList(list);
                        setShowDeleteModal(true);
                      }}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      Delete List
                    </button>
                  </div>
                </div>

                {expandedLists[list._id] && (
                  <div className="space-y-4">
                    {/* Add Email Form */}
                    <div className="flex gap-4 mb-4">
                      <input
                        type="text"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter email"
                        className="flex-1 px-4 py-2 border rounded-md"
                      />
                      <button
                        onClick={() => handleAddEmail(list._id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                      >
                        Add Email
                      </button>
                    </div>

                    {/* File Upload */}
                    <div className="mb-4">
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={(e) =>
                          handleFileUpload(list._id, e.target.files[0])
                        }
                        className="w-full p-2 border rounded-md"
                      />
                    </div>

                    {/* Email List */}
                    <div className="bg-gray-50 rounded-md p-4">
                      {list.emails.map((email, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center py-2"
                        >
                          <span>{email}</span>
                          <button
                            onClick={() => handleRemoveEmail(list._id, email)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!expandedLists[list._id] && (
                  <div className="mt-2">
                    {list.emails.slice(0, 5).map((email, index) => (
                      <div key={index} className="text-gray-600">
                        {email}
                      </div>
                    ))}
                    {list.emails.length > 5 && (
                      <div className="text-gray-500 mt-2">
                        ...and {list.emails.length - 5} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Delete List?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedList?.listName}? This
              action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteList(selectedList._id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lists;
