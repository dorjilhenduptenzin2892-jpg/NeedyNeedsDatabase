<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/118xlSgrX1utzTx_vWvYTcNTp5mU_26kU

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel (public, uses Google Apps Script)

1. In Vercel Project Settings → Environment Variables, add:
   - `VITE_WEB_APP_URL` = your Apps Script URL (example: `https://script.google.com/macros/s/AKfycbzkU61DPOJESPo.../exec`)
2. Ensure `@types/node` is included in `dependencies` (already handled).
3. Trigger a redeploy.

Automate setting the env var locally:

```bash
# Install deps
npm install

# Run the helper script (requires VEREL_TOKEN and VERCEL_PROJECT_ID env vars)
node scripts/set-vercel-env.js "VITE_WEB_APP_URL" "https://script.google.com/macros/s/AKfycbzkU61DPOJESPo.../exec"
```

Security: this makes your sheet readable/editable by anyone with the URL. Do not store sensitive data in the sheet.
