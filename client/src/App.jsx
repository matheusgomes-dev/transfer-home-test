import React, { useState, useEffect, useCallback, useRef } from "react";

// --- Firebase Imports and Setup (MANDATORY BOILERPLATE) ---
// Note: While this app's core RAG logic uses the Node backend,
// the Firebase setup remains mandatory for platform compatibility.
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Global variables provided by the environment
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const firebaseConfig =
  typeof __firebase_config !== "undefined" ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;
// --- END FIREBASE SETUP ---

// --- Backend API Configuration ---
// The server handles the RAG logic and secure API key access.
const BACKEND_API_URL = "/api/chat";
// If running client/server separately (e.g., Vite on 5173, Node on 3001),
// you would use 'http://localhost:3001/api/chat' instead,
// but for a unified build, the relative path is correct.

const App = () => {
  const [fileContent, setFileContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [error, setError] = useState(null);

  // Firebase State (Used for mandatory setup, not chat data persistence in this demo)
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const authRef = useRef(null);
  const dbRef = useRef(null);

  // Scroll reference for chat history
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [chatHistory]);

  // --- Firebase Initialization and Auth ---
  useEffect(() => {
    if (Object.keys(firebaseConfig).length === 0) {
      console.warn("Firebase config not available. Proceeding without persistent storage.");
      setIsAuthReady(true);
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      authRef.current = auth;
      dbRef.current = db;

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(auth, initialAuthToken);
            } else {
              await signInAnonymously(auth);
            }
          } catch (e) {
            console.error("Firebase auth failed:", e);
          }
        }
        setUserId(auth.currentUser?.uid || crypto.randomUUID());
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error initializing Firebase:", e);
      setIsAuthReady(true);
    }
  }, []);
  // --- END Firebase Initialization ---

  // Utility to handle exponential backoff for retrying API calls
  const fetchWithBackoff = useCallback(async (url, options) => {
    const maxRetries = 3;
    let delay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.status === 429 && i < maxRetries - 1) {
          console.warn(`Rate limit hit. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        if (!response.ok) {
          const errorDetail = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(
            `API Request Failed: ${response.status} - ${errorDetail.error || errorDetail.message}`
          );
        }
        return response;
      } catch (e) {
        if (i === maxRetries - 1) throw e; // Throw if last retry
        console.error("Fetch attempt failed, retrying:", e.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      setChatHistory([]); // Clear chat history on new file upload
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent(e.target.result);
        // Add introductory message after file is loaded
        setChatHistory([
          {
            role: "ai",
            text: `File **${file.name}** uploaded successfully. Ask me a question about its content!`,
          },
        ]);
      };
      reader.onerror = () => {
        setError("Error reading file.");
      };
      reader.readAsText(file);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !fileContent) return;

    const userQuestion = userInput.trim();

    // 1. Add user message to history
    setChatHistory((prev) => [...prev, { role: "user", text: userQuestion }]);
    setUserInput("");
    setIsLoading(true);
    setError(null);

    // 2. Prepare payload for the secure Node backend
    const payload = {
      fileContent: fileContent,
      userQuestion: userQuestion,
    };

    try {
      const response = await fetchWithBackoff(BACKEND_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      console.log("result", result);

      if (result.error) {
        throw new Error(result.error);
      }

      // 3. Add AI response to history
      setChatHistory((prev) => [...prev, { role: "ai", text: result.answer }]);
    } catch (e) {
      console.error("Backend communication failed:", e.message);
      setError(`Failed to get answer from server. Details: ${e.message}`);

      // Add a system error message to the chat history
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          text: `⚠️ **Server Error:** I couldn't process that request. Please check the backend server logs. (${e.message})`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const FileUploadArea = () => (
    <div className="p-4 bg-white text-gray-800 rounded-xl shadow-lg border border-gray-200 mb-4">
      <label className="flex flex-col items-center justify-center p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition rounded-lg border-2 border-dashed border-gray-300">
        <svg
          className="w-6 h-6 mb-2 text-indigo-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 16a4 4 0 01-4-4v-1m4 4h10m-10 0a4 4 0 00-4 4v-1m14-4v-1m-4 4h-4m4-4a4 4 0 00-4-4H7a4 4 0 00-4 4v1m14 0a4 4 0 01-4 4v-1m4-4H7"
          ></path>
        </svg>
        <span className="text-sm font-medium">
          {fileName ? `File Uploaded: ${fileName}` : "Click to upload a .txt or .md file"}
        </span>
        <input
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".txt,.md" // Limiting file types for this demo
        />
      </label>
      {fileName && (
        <p className="mt-2 text-xs text-green-600 text-center">
          Ready to chat about the content of **{fileName}**.
        </p>
      )}
    </div>
  );

  const ChatMessage = ({ role, text }) => {
    const isUser = role === "user";
    // User messages remain indigo on light background
    const bgColor = isUser ? "bg-indigo-600" : "bg-white border border-gray-200";
    // AI messages now have dark text
    const textColor = isUser ? "text-white" : "text-gray-800";
    const alignment = isUser ? "self-end" : "self-start";
    const avatar = isUser ? "👤" : "🤖";

    console.log("text", text);

    // Simple markdown conversion for bolding and newlines
    let htmlContent = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    htmlContent = htmlContent.replace(/\n/g, "<br/>");

    return (
      <div className={`max-w-xs sm:max-w-md ${alignment} my-2 flex items-start space-x-2`}>
        {!isUser && <div className="p-2 text-xl">{avatar}</div>}
        <div className={`p-3 rounded-xl shadow-md ${bgColor} ${textColor}`}>
          <div className="text-sm" dangerouslySetInnerHTML={{ __html: htmlContent }}></div>
        </div>
        {isUser && <div className="p-2 text-xl">{avatar}</div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans flex justify-center">
      <div className="w-full max-w-2xl flex flex-col h-[90vh] bg-white rounded-2xl shadow-2xl p-6">
        <h1 className="text-3xl font-extrabold text-gray-800 text-center mb-2">File Q&A Chat</h1>
        <p className="text-sm text-gray-500 text-center mb-4">
          Upload a file, ask a question. Powered by your secure Node backend.
        </p>

        <div className="mb-4">
          {isAuthReady && userId && (
            <p className="text-xs text-gray-400 text-center mb-1">
              User ID: {userId} (App: {appId})
            </p>
          )}
          <FileUploadArea />
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-100 text-red-800 border border-red-300 rounded-lg text-sm font-medium">
            Error: {error}
          </div>
        )}

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-200 rounded-xl mb-4 shadow-inner">
          {chatHistory.length === 0 ? (
            <div className="text-center text-gray-500 pt-8">
              {fileContent
                ? "Ask a question about your uploaded file below!"
                : "Upload a file to begin."}
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <ChatMessage key={index} role={msg.role} text={msg.text} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <input
            type="text"
            className="flex-1 p-3 rounded-xl bg-gray-50 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 border border-gray-300"
            placeholder={fileContent ? "Ask your question..." : "Upload a file first..."}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isLoading || !fileContent}
          />
          <button
            type="submit"
            className={`p-3 rounded-xl font-bold transition-all duration-200 shadow-lg ${
              isLoading || !fileContent
                ? "bg-indigo-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
            }`}
            disabled={isLoading || !fileContent}
          >
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;
