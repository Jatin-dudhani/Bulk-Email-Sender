import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import axios from 'axios';
import { API_ENDPOINTS } from '../utils/constants';

const EmailSettings = () => {
  const [senderEmail, setSenderEmail] = useState('');
  const auth = getAuth();

  const handleAddEmail = async () => {
    try {
      const response = await axios.post(API_ENDPOINTS.VERIFY_SENDER, {
        userId: auth.currentUser.uid,
        senderEmail: senderEmail
      });
      
      // Handle verification email sent
      if(response.data.success) {
        alert('Verification email sent! Please check your inbox.');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Sender Email Settings</h2>
        <div className="flex gap-4">
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="Enter your sender email"
            className="flex-1 px-4 py-2 border rounded-md"
          />
          <button
            onClick={handleAddEmail}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Add Email
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailSettings;
