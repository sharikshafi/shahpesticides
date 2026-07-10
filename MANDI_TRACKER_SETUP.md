# Mandi Price Tracker — Setup (10 minutes, one-time)

This adds a live apple mandi price widget to your site, updated automatically
every morning from the Government of India's Agmarknet data feed.

## Files added
- `index.html` — updated with the price widget (CSS + HTML + JS)
- `mandi-prices.json` — the price data the website reads. Currently has
  **sample placeholder numbers** so the widget shows something immediately.
- `fetch-mandi-prices.mjs` — the script that fetches real data and overwrites `mandi-prices.json`
- `.github/workflows/update-mandi-prices.yml` — runs that script automatically every day

## One-time setup

1. **Get a free API key**
   Go to https://data.gov.in → Sign Up → after logging in, go to "My Account" →
   "API Keys" and generate one. Takes about 2 minutes, no cost.

2. **Push these files to your GitHub repo** (wherever your site's code lives —
   if it's not on GitHub yet, that's the only real requirement for the
   automatic part to work, since GitHub Actions is what runs the daily job).

3. **Add your API key as a secret**, so it's never exposed in your code:
   Repo → Settings → Secrets and variables → Actions → "New repository secret"
   - Name: `DATA_GOV_IN_API_KEY`
   - Value: (the key from step 1)

4. **Turn on GitHub Actions** if it isn't already (Settings → Actions → General
   → Allow all actions). The workflow will now run automatically every day
   at 5:00 AM IST, or you can trigger it manually anytime from the
   "Actions" tab → "Update Kashmir Apple Mandi Prices" → "Run workflow".

That's it — from here on, `mandi-prices.json` updates itself daily and the
website widget just reads it. No manual work, no exposed keys.

## Testing it locally first (optional)
```
export DATA_GOV_IN_API_KEY=your_key_here
node fetch-mandi-prices.mjs
```
This will overwrite `mandi-prices.json` with real data so you can check it
before pushing live.

## Notes
- If a mandi doesn't report on a given day (common on Sundays/holidays), the
  widget keeps showing the last known price rather than breaking.
- The widget currently shows all J&K mandis with apple price records that
  day and splits prices by variety (American/Delicious, Kullu Delicious,
  Maharaji, etc.) — exactly as they appear in the Agmarknet feed.
- If you rename/move `index.html`, keep `mandi-prices.json` in the same
  folder — the widget fetches it as a relative path (`./mandi-prices.json`).
