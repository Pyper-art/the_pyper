# the_pyper — local test UI for Piper

A static chat UI (HTML/CSS/JS) for exercising the Piper API. It auto-detects
where it is running:

- Opened locally (`file://` or `localhost`) → talks to a local server at
  `http://127.0.0.1:8002`
- Served from a real host → talks to the deployed backend

## Run it locally

You need two things running: the **Piper API** and a **static server** for this UI.

### 1. Start the Piper API (from the repo root)

```bash
# from: experiments-ml/
# PIPER_DISABLE_AUTH lets the UI call the API without a real api_key (DEV ONLY)
#   PowerShell:  $env:PIPER_DISABLE_AUTH = "1"
#   bash:        export PIPER_DISABLE_AUTH=1
uvicorn naimexi_piper.main:app --host 127.0.0.1 --port 8002 --reload
```

This standalone app serves only Piper (no WhatsApp/scheduler/etc.). It reads
`SUPABASE_URL`, `SUPABASE_KEY`, and `GROQ_API_KEY` from `naimexi_piper/.env`.

Sanity-check it: open <http://127.0.0.1:8002/piper/health> — you should see
`{"status":"healthy",...}`.

### 2. Serve this UI

Open a second terminal:

```bash
# from: experiments-ml/naimexi_piper/the_pyper/
python -m http.server 5500
```

Then open <http://127.0.0.1:5500> in your browser. The console will log
`Piper UI -> API_BASE: http://127.0.0.1:8002`.

> Tip: serving via `http.server` (rather than double-clicking `index.html`)
> gives the page a real origin, which keeps browser CORS happy.

## Pointing at the deployment instead

Just open the deployed URL (the UI auto-switches to the remote API). If that
deployment enforces auth, set `API_KEY` near the top of `app.js` to a valid key.

## Auth notes

- The `/piper/query` and `/piper/report/analyze` endpoints require an `api_key`
  header in production.
- For local testing, run the server with `PIPER_DISABLE_AUTH=1` and leave
  `API_KEY` empty in `app.js`. **Never** set `PIPER_DISABLE_AUTH=1` in production.
