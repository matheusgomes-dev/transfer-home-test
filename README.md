🚀 File Q&A Chat Demo: Full-Stack RAG with React and Node
This project demonstrates a secure, containerized Retrieval-Augmented Generation (RAG) system using a React frontend (Vite/Tailwind) and a secure Node/Express backend to communicate with the Gemini API.

⚙️ Project Structure
The final project uses a standard full-stack setup:

- / (Root): Contains configuration files (docker-compose.yml, package.json, .env).

- /src: Contains the secure Node/Express server (server.js).

- /client: Contains the React application (App.jsx).

🔒 Handling the Gemini API Key
The API key is a secret credential and must never be exposed in the frontend code. This project uses the Node server to secure the key:

1. **Create the .env file**: In the **root directory** of your project (alongside docker-compose.yml), create a file named .env.

2. **Paste your key**: Add your key to this file:

`GEMINI_API_KEY="YOUR_API_KEY_HERE"`

3. **Secure Loading**: The Node server (server.js) uses dotenv to load this key, and the docker-compose.yml file is configured to pass this secret file only to the server container, keeping it secure.

🛠️ **How to Build and Run the Project**
The easiest and most reliable way to run the entire application is using Docker Compose.

**Prerequisites**
You must have Docker and Docker Compose installed on your system.

**Step 1: Install Client Dependencies and Build**
Before Docker can copy the built client, you must run the build script locally.

```
# 1. Navigate to the client directory

cd client

# 2. Install React dependencies (including Firebase client libraries)

npm install

# 3. Build the static production files (creates the 'dist' folder)

npm run build

# 4. Return to the root directory

cd ..
```

**Step 2: Run with Docker Compose**
Ensure your .env file is set up (as described above). Run the following command from the root directory:

```
# This command builds the images and starts the container,

# securely passing the .env file to the server.

docker compose up --build
```

**Step 3: Access the Application**
Once the server reports that it is running (default port 3001), access the application in your web browser:

`http://localhost:3001`

You are now running a containerized, full-stack RAG application!

✨ **Bonus Ideas and Future Development**
If this project were taken to the next level, here are a few key areas for improvement that address the initial "Bonus Ideas" and scale the solution:

1. **Advanced RAG with Vector Search**
   Current Solution: The current method uses a simple "chunk and send all relevant chunks" approach, which is fast for demos but inefficient for large documents.

Improvement: Implement a proper vector database (e.g., using a library like chroma-js on the Node server, or a hosted service like Pinecone/Weaviate). This would involve:

Embedding: Using a specialized embedding model (like text-embedding-004) to convert text chunks into dense vectors upon file upload.

Vector Search: Converting the user's question into a vector and performing a similarity search to retrieve only the top 3-5 most relevant chunks to ground the LLM's answer.

2. **Multi-User Persistence**
   Current Solution: File content is stored only in the browser's React state (fileContent). It disappears on refresh.

Improvement: Leverage the existing Firebase/Firestore setup to store:

User documents (in /artifacts/{appId}/users/{userId}/files).

Chat histories linked to specific files.

This would allow users to refresh the page, close their browser, and return to their files and conversations.

3. **Enhanced UI/UX and File Handling**
   File Format Support: Use a library like pdf-parse on the Node server to reliably extract text from PDF files.

Real-time Output: Use a streaming API approach for the chat response, so the AI's answer appears word-by-word instead of waiting for the full response.

Source Citation: When grounding the answer, the server should return the specific text chunk(s) used. The frontend could then display these chunks as clickable footnotes or context windows next to the AI's reply.
