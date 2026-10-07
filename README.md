# Resume Analyser

An AI resume checker that runs entirely in the browser. You upload a resume (PDF, DOCX, TXT or MD) and can
optionally paste a job description. In about 10–30 seconds you get a detailed report: an overall score, an
ATS score, a job-match score, six category scores, prioritised fixes, ATS checks, keyword gaps and rewritten
bullet points.

It's built with plain HTML, CSS and JavaScript and powered by the free tier of the Google Gemini API. There's
no backend, no database and no build step.

---

## Table of contents
- [Quick start](#quick-start) (includes deploying to Vercel)
- [Getting a Gemini API key](#getting-a-gemini-api-key)
- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [The AI part in detail](#the-ai-part-in-detail)
- [Privacy and security](#privacy-and-security)
- [Limits](#limits)
- [Troubleshooting](#troubleshooting)

---

## Quick start

You need any static file server. Python 3 comes preinstalled on macOS and most Linux systems.

```bash
cd resume_analyser
python3 -m http.server 8000
```

Open **http://localhost:8000** in your browser.

> Don't open `index.html` directly (as a `file://` URL). The app uses JavaScript ES modules, which browsers
> only load over `http://`.

Other servers work too, for example `npx serve .` or VS Code's Live Server extension.

**Live demo:** https://resumeanalyser-blond.vercel.app

### Deploy to Vercel
It's a static site, so no build settings or environment variables are needed:
```bash
npm i -g vercel        # once
vercel login           # once
vercel deploy --prod   # from the project folder
```
Each visitor enters their own Gemini key in Settings. No key is stored on Vercel.

---

## Getting a Gemini API key

The app needs a **Google Gemini API key**. It's free, and no credit card is needed.

1. Go to **https://aistudio.google.com/apikey** and sign in with a Google account.
2. Click **Create API key** and copy it. It usually starts with `AIza`.
3. In the app, click the **gear icon** (or press `,`), paste the key, click **Test key**, then **Save**.

**You don't put the key in any file.** There is no `.env` or config file. The key is saved in your
browser's `localStorage` under `ra.apiKey`, so you only enter it once per browser.

In the same Settings panel you can pick the model:

| Model | Notes |
|---|---|
| `gemini-3.8-flash` (default) | Best quality, slowest |
| `gemini-3.5-flash` | Balanced |
| `gemini-3.5-flash-lite` | Fastest, with higher free-tier limits. Good for demos |
| `gemini-3.1-flash-lite` | Fallback |

---

## Features

- **Upload or paste**: drag and drop a PDF, DOCX, TXT or MD file (up to 5 MB), or click **Try a sample**.
- **Optional job description**: when you add one, you also get a **job-match score**, and keywords are
  compared against the posting.
- **Scores**: overall score (0–100), ATS score and job-match score, shown as animated rings with a band
  (*Exceptional / Strong / Room to grow / Needs work*).
- **6 category scores**: Impact & Results, ATS Compatibility, Skills & Keywords, Structure & Formatting,
  Brevity & Length, Writing Style. Each has specific feedback.
- **Prioritised improvements**: 5–10 fixes tagged high / medium / low, each with a concrete example.
- **What-if simulator**: tick "I'll fix this" on improvements and a projected score updates live
  (+6 for high, +3 for medium, +1 for low, capped at 100).
- **ATS checks**: pass/fail checks such as contact info, standard headings, consistent dates and no tables
  or columns.
- **Keywords**: matched and missing keywords. Click a missing keyword to copy it.
- **Bullet rewrites**: your 3–5 weakest bullets rewritten, with a before/after word diff and a copy button.
- **Strengths, plus hard and soft skills** found in the resume.
- **Extras**: light/dark theme, keyboard shortcuts (press `?`), print/download the report (`P`), copy all
  suggestions as text, confetti for scores of 85+, and support for the reduced-motion setting.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| UI | **HTML5 + CSS3** (custom properties, grid, animations) | No framework needed, fast to load |
| Logic | **Vanilla JavaScript (ES modules)** | No build step: just serve the files |
| PDF parsing | **[pdf.js](https://mozilla.github.io/pdf.js/)** `4.10.38` (Mozilla), loaded from the jsDelivr CDN | Reads text from PDFs in the browser, using a Web Worker |
| DOCX parsing | **[mammoth.js](https://github.com/mwilliamson/mammoth.js)** `1.13.0`, loaded from the cdnjs CDN | Extracts raw text from Word files |
| AI | **Google Gemini API** (REST `generateContent`, `v1beta`) | Free tier, and supports structured JSON output |
| Fonts | Google Fonts: Inter + Plus Jakarta Sans | Typography |
| Storage | Browser `localStorage` | Saves the API key, chosen model and theme |
| Hosting | Any static server | No backend |

The PDF and DOCX libraries are **lazy-loaded**. They're only downloaded when you actually upload that type
of file.

---

## How it works

```
┌──────────────┐    ┌────────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│ Resume file  │ ─▶ │  parser.js         │ ─▶ │  gemini.js           │ ─▶ │  app.js         │
│ PDF/DOCX/TXT │    │  extract plain     │    │  prompt + JSON schema│    │  render report, │
│ + optional JD│    │  text (in browser) │    │  → Gemini API        │    │  animations,    │
└──────────────┘    └────────────────────┘    │  ← structured JSON   │    │  what-if        │
                                              └──────────────────────┘    └─────────────────┘
```

Step by step:

1. **Input.** `app.js` checks the file's type and size (≤ 5 MB) and takes the optional job description
   (≤ 15,000 characters in the text box).
2. **Text extraction** (`parser.js`, entirely in the browser):
   - **PDF**: pdf.js reads every page's text and joins the lines. If almost no text is found, the PDF is
     probably a scanned image, and the user is told to export a text-based PDF instead.
   - **DOCX**: mammoth extracts the raw text.
   - **TXT / MD**: read directly.
   - The text is then cleaned up: whitespace collapsed, control characters removed, blank lines limited.
     At least 50 characters are required.
3. **Analysis request** (`gemini.js`):
   - Builds a **system instruction** that sets the model up as a senior recruiter, with a calibrated scoring
     rubric and rules.
   - Wraps the resume in `<resume>` tags and the job description in `<job_description>` tags. The resume
     is capped at 30,000 characters and the job description at 12,000.
   - Sends a `POST` to `generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`, with a
     **JSON schema** that forces Gemini to reply in an exact structure.
4. **Response handling**: checks for safety blocks, empty responses or truncation, parses the JSON, and
   normalises it (clamps scores, sorts improvements high → low).
5. **Rendering** (`app.js`): animates the score rings and builds every report section from the JSON.
   While the request runs, a progress list and rotating resume tips are shown.

---

## Project structure

```
resume_analyser/
├── index.html      # Page markup: hero/upload form, progress panel, results view, settings & help dialogs
├── styles.css      # All styling: design tokens, light/dark themes, layout, animations
└── js/
    ├── app.js      # UI controller: upload, settings, analysis flow, rendering, what-if, shortcuts
    ├── gemini.js   # Gemini API client: prompt, JSON schema, request, retries, error mapping
    ├── parser.js   # Text extraction for PDF (pdf.js), DOCX (mammoth) and TXT/MD
    └── sample.js   # Sample resume used by "Try a sample"
```

---

## The AI part in detail

### Structured output (JSON schema)
Gemini doesn't return free-form text. `gemini.js` defines a `RESPONSE_SCHEMA` and sends it as
`generationConfig.responseJsonSchema`. Gemini must return JSON with:

| Field | Content |
|---|---|
| `overallScore`, `atsScore` | Integers from 0 to 100 |
| `jobMatchScore` | 0–100, or `null` when no job description was given |
| `verdict`, `summary` | Short headline and a 2–3 sentence assessment |
| `candidate` | Name, title, years of experience |
| `categories` | Exactly 6 category scores with feedback |
| `strengths` | 3–6 items |
| `improvements` | 5–10 items, each with priority, category, title, detail and example |
| `atsChecks` | 6–10 pass/fail checks |
| `keywords` | `matched` and `missing` |
| `bulletRewrites` | 3–5 items: original, improved, reason |
| `skills` | `hard` and `soft` |

Because the structure is guaranteed, the UI can render the report reliably. If a model rejects
`responseJsonSchema`, the client automatically retries once using the older OpenAPI-style
`responseSchema` format.

### Prompt design
- **Calibrated rubric**: 90+ is exceptional, and most real resumes land between 55 and 80, so scores
  aren't inflated.
- **Grounded feedback**: the model must quote the actual resume and never invent numbers. Unknown
  metrics become placeholders like `[X%]`.
- **Prompt-injection guard**: the resume and job description are treated strictly as data, and any
  instructions inside them are ignored.
- **Temperature**: Gemini 3.x models use their default temperature, as Google recommends. Older models use
  `0.3` for more consistent scoring.

### Error handling and retries
HTTP errors are turned into friendly messages:

| Status | Meaning shown to the user |
|---|---|
| 400 | Invalid key, unsupported region, input too long, or bad request |
| 401 / 403 | Key invalid or restricted, or the API isn't enabled |
| 404 | Model not available for this key |
| 429 | Rate limit, either per minute or daily |
| 5xx / 503 | Gemini server error or overload |

Errors that can be retried (network failure, 5xx, empty or malformed response) are **retried once after
2 seconds**. **Test key** uses a cheap "list models" call that doesn't use up generation quota.

---

## Privacy and security

- **Files never leave your computer.** Parsing happens in the browser. Only the extracted **text** is sent,
  and only to Google's Gemini API.
- **The API key stays in your browser** (`localStorage`). It's sent only to
  `generativelanguage.googleapis.com`, in the `x-goog-api-key` header, never in the URL.
- No backend, analytics or database. Nothing is stored on any server by this app.
- All model output is HTML-escaped before rendering, to prevent XSS.
- Note: on Google's free tier, Google may use prompts to improve its products. Avoid uploading resumes
  you aren't comfortable sharing with Google.

---

## Limits

| Limit | Value |
|---|---|
| File size | 5 MB |
| Supported formats | PDF (text-based), DOCX, TXT, MD. Old `.doc` and scanned PDFs are not supported |
| Resume text sent to Gemini | 30,000 characters |
| Job description sent to Gemini | 12,000 characters |
| Typical analysis time | ~10–30 seconds, depending on the model and Gemini's load |

AI scores can vary a little between runs.

---

## Troubleshooting

**Stuck on "Analyzing…" for more than a minute.** The progress steps are only an animation. The real
request has no timeout, so if Gemini doesn't respond, the app keeps waiting. To find out why:
1. Open DevTools (**Cmd + Option + I** on Mac, **F12** on Windows) and go to **Network → Fetch/XHR**.
2. Run the analysis again and find the `:generateContent` request:
   - **(pending)**: Gemini is slow or overloaded. Reload and switch to a Flash-Lite model.
   - **401/403**: your key is the problem. Create a new one.
   - **429**: rate limit. Wait a minute or switch models.
   - **5xx**: Gemini server issue. Try again later.
   - **failed / CORS**: network, VPN or ad-blocker problem.
   - **No request at all**: check the **Console** tab for JavaScript errors.
3. Test your key outside the app:
   ```bash
   curl -s -w "\nHTTP %{http_code} in %{time_total}s\n" \
     -H "x-goog-api-key: YOUR_KEY" -H "Content-Type: application/json" \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent" \
     -d '{"contents":[{"parts":[{"text":"Say hi"}]}]}'
   ```

**"No readable text found in this PDF."** The PDF is a scanned image. Export your resume as a text-based
PDF or as DOCX.

**Page is blank, or modules fail to load.** You probably opened the file directly. Use
`python3 -m http.server` as shown in [Quick start](#quick-start).

**"Could not load the PDF reader."** pdf.js and mammoth load from CDNs, so check your internet connection
and any ad-blocker.
