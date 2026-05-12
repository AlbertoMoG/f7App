<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/56263d1d-10e8-4355-a232-96b0ffb80db8

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. If you are on Windows, run:
   `npm run setup:win`
3. Create `.env.local` from [.env.example](.env.example) and fill values:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
4. (Optional) `VITE_GEMINI_API_KEY` — only if you call Gemini from the client; key is embedded in the bundle. Prefer a server proxy for production.
5. (Optional) Add `VITE_FIREBASE_STORAGE_BUCKET` and `VITE_FIREBASE_MESSAGING_SENDER_ID`
6. Run the app:
   `npm run dev`
