# ⚡ Orin Backend - Website Generation API

## 🌟 Overview

The **Orin Backend** powers the API that transforms text prompts into complete website code using Groq-hosted language models. This service processes natural language requests and returns structured project files for instant website generation.

## 💻 Tech Stack

- Express.js
- Groq API
- Node.js

## 📥 Installation

1. **Install dependencies**
    ```bash
    npm install
    ```

2. **Setup environment variables**
    Create a `.env` file:
    ```
    GROQ_API_KEY=your-groq-api-key
    GROQ_MODEL=llama-3.3-70b-versatile
    PORT=3030
    FRONTEND_URL=http://localhost:3001
    ```

3. **Run the server**
    ```bash
    npm run dev
    ```

The API exposes `GET /health`, `POST /template`, and `POST /chat`. It runs as
a standalone Express service backed directly by Groq.
