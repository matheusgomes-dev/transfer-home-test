const express = require("express");
const nodeFetch = require("node-fetch");
const fetch = nodeFetch.default || nodeFetch;
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GEMINI_API_KEY;
const CLIENT_BUILD_PATH = process.env.CLIENT_BUILD_PATH || "../client/dist";

// Allow CORS for development (if client runs on a different port)
app.use(cors());
app.use(express.json({ limit: "5mb" })); // Increased limit for large file uploads

// --- RAG (Retrieval Augmented Generation) Logic ---

/**
 * Splits text content into chunks (simplified RAG chunking).
 */
const chunkFileContent = (text, maxChunkSize = 500) => {
  if (!text) return [];
  const sentences = text.split(/(\n\n|\n|(?<=[.?!]))\s*/).filter((s) => s.trim().length > 0);
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
};

// --- API Endpoint: /api/chat ---
app.post("/api/chat", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not set in environment." });
  }

  const { fileContent, userQuestion } = req.body;

  if (!fileContent || !userQuestion) {
    return res.status(400).json({ error: "Missing fileContent or userQuestion in request body." });
  }

  try {
    const contextChunks = chunkFileContent(fileContent);
    const contextString = contextChunks.join("\n---\n");

    const systemPrompt = `You are a helpful and accurate Q&A system. Your sole task is to answer the user's question ONLY using the provided file content delimited by "FILE CONTENT START" and "FILE CONTENT END".
        
        RULES:
        1. If the answer is not found in the file content, state clearly that the information is not available in the document. Do NOT use external knowledge.
        2. Keep the answer concise and factual.
        
        FILE CONTENT START
        ${contextString}
        FILE CONTENT END`;

    const apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

    const payload = {
      contents: [{ parts: [{ text: userQuestion }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.2 },
    };

    // Call the Gemini API from the secure backend
    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": API_KEY, // Using header for security
      },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      throw new Error(`Gemini API request failed: ${geminiResponse.status} - ${errorBody}`);
    }

    const result = await geminiResponse.json();
    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I could not generate a response from the file content.";

    res.json({ answer: text });
  } catch (error) {
    console.error("Server RAG Error:", error.message);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request.", details: error.message });
  }
});

// --- Static File Serving (React Frontend) ---

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, CLIENT_BUILD_PATH)));

// For any other GET request, send the index.html file (allows client-side routing)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, CLIENT_BUILD_PATH, "index.html"));
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving static files from: ${path.join(__dirname, CLIENT_BUILD_PATH)}`);
});
