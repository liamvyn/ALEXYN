# ALEXYN — Learn · Explore · Excel

ALEXYN is an installable full-stack AI learning companion with streaming Explore AI chat, online source citation retrieval, customizable Smart Notes, multi-format adaptive Quizzes & Exam Player, voice dictation & text-to-speech, and offline STEM Practice Labs.

## Quick Start (Run Anywhere Locally)

1. **Install dependencies** (Node.js 22+ recommended):
   ```bash
   npm install
   ```

2. **Configure your AI key in `.env`** (never commit secrets or hardcode keys in HTML/JS):
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set **at least one** provider key:
   - **OpenAI / ChatGPT**: set `OPENAI_API_KEY=sk-...` (optional `OPENAI_MODEL=gpt-4o-mini`)
   - **Google Gemini**: set `GEMINI_API_KEY=AIza...` (optional `GEMINI_MODEL=gemini-3.5-flash-lite`)
   - **Groq (Free tier)**: set `GROQ_API_KEY=gsk_...`
   - **OpenRouter (`:free` models & more)**: set `OPENROUTER_API_KEY=sk-or-...`
   - **Mistral**: set `MISTRAL_API_KEY=...`
   - **Local Ollama / LM Studio (100% offline/free)**: set `AI_CUSTOM_BASE_URL=http://localhost:11434/v1` and `AI_CUSTOM_MODEL=llama3.2`

3. **Run in development or production**:
   - Development: `npm run dev` (starts Express + Vite on `http://localhost:3000`)
   - Production:
     ```bash
     npm run build
     NODE_ENV=production npm start
     ```

---

## Publishing / Deploying Anywhere Else

### Option 1: Full-Stack Cloud Host (Render, Railway, Fly.io, DigitalOcean, VPS)
1. Push the repository to GitHub (make sure `.env` is **not** committed).
2. Set your provider secret(s) (e.g. `OPENAI_API_KEY` or `GEMINI_API_KEY`) in your host's **Environment Variables / Secrets** dashboard.
3. Build command: `npm install && npm run build`
4. Start command: `npm start` (set `NODE_ENV=production`).

### Option 2: Separate Frontend + Backend Hosting (e.g. GitHub Pages / Netlify / Vercel + Render/Railway Backend)
- Deploy `server.ts` on any Node host (`npm start`). CORS is pre-enabled.
- Deploy `dist/` (or the generated standalone single-file `index.html`) to any static host.
- Inside the published frontend, open **Settings → Backend Server URL**, paste your deployed backend URL (e.g. `https://your-alexyn-server.onrender.com`), and click **Save URL**.

---

## Installing ALEXYN as an App (Desktop & Mobile PWA)
When opened over `https://` or `http://localhost:3000`:
- Click **Install App** in ALEXYN's top bar or **Settings**, or use your browser's **Install / Add to Home Screen** menu (on iOS Safari: **Share → Add to Home Screen**).
- Offline study tools (Scientific Calculator, Math Notebook, 3D Geometry Labs, Saved Notes, Saved Quizzes) continue working without internet access.
