# Resume Analyser

AI resume checker built with vanilla HTML/CSS/JS and powered by the free Google Gemini API.

## Run
```bash
cd resume_analyser
python3 -m http.server 8000
# open http://localhost:8000
```

## Gemini API key (free)
1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Click **Create API key** and copy it. No billing is needed for the free tier.
3. In the app, click the gear icon, paste the key, click **Test key**, then **Save**.

The key is stored in your browser's `localStorage` (`ra.apiKey`) and is sent only to
`generativelanguage.googleapis.com`, in the `x-goog-api-key` header.
Default model: `gemini-3.8-flash`. If you hit rate limits, switch models in Settings.

## Files
- `index.html`, `styles.css`, `js/app.js`: UI, flow, animations, what-if simulator
- `js/gemini.js`: Gemini API client (structured JSON output, retries, error mapping)
- `js/parser.js`: PDF (pdf.js) / DOCX (mammoth) / TXT text extraction, all in the browser
- `js/sample.js`: sample resume for the "Try a sample" button
