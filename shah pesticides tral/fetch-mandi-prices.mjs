/**
 * fetch-mandi-prices.mjs
 * ─────────────────────────────────────────────────────────────
 * Pulls today's Apple mandi prices for Jammu & Kashmir from the
 * Government of India's open data API (Agmarknet, via data.gov.in)
 * and writes them to mandi-prices.json — a small static file that
 * the website reads directly (no API key ever reaches the browser).
 *
 * This is meant to be run automatically once a day by a GitHub
 * Actions cron job (see .github/workflows/update-mandi-prices.yml).
 * You can also run it manually: `node fetch-mandi-prices.mjs`
 *
 * Setup (one-time):
 *   1. Get a free API key: https://data.gov.in/ → Sign Up → My Account → API Keys
 *   2. Add it as a GitHub repo secret named DATA_GOV_IN_API_KEY
 *      (Settings → Secrets and variables → Actions → New repository secret)
 * ─────────────────────────────────────────────────────────────
 */

import { writeFile, readFile } from 'fs/promises';

const API_KEY = process.env.DATA_GOV_IN_API_KEY;
const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070'; // Variety-wise Daily Market Prices (Agmarknet)
const OUTPUT_FILE = new URL('./mandi-prices.json', import.meta.url);

if (!API_KEY) {
  console.error('Missing DATA_GOV_IN_API_KEY environment variable. See setup notes at the top of this file.');
  process.exit(1);
}

// Only the fields we actually need — keeps the JSON tiny.
function buildUrl(offset) {
  const params = new URLSearchParams({
    'api-key': API_KEY,
    format: 'json',
    limit: '200',
    offset: String(offset),
    'filters[state]': 'Jammu and Kashmir',
    'filters[commodity]': 'Apple',
  });
  return `https://api.data.gov.in/resource/${RESOURCE_ID}?${params.toString()}`;
}

async function fetchAllRecords() {
  let all = [];
  let offset = 0;
  // The API paginates in blocks of ~200; a normal day's worth of J&K apple
  // records across all mandis/varieties is well under 1000, so a handful
  // of pages is always enough — this loop just makes sure nothing's missed.
  for (let page = 0; page < 8; page++) {
    const res = await fetch(buildUrl(offset));
    if (!res.ok) throw new Error(`Agmarknet API returned ${res.status}`);
    const data = await res.json();
    const records = data.records || [];
    all = all.concat(records);
    if (records.length < 200) break;
    offset += 200;
  }
  return all;
}

// The API returns commodity variety as its own field (e.g. "American",
// "Delicious", "Kullu Delicious", "Maharaji", "Ambri", "Other" etc.)
// grouped under commodity "Apple". We key everything by market + variety.
function groupRecords(records) {
  const byMandi = {};
  for (const r of records) {
    const mandi = (r.market || 'Unknown Market').trim();
    const district = (r.district || '').trim();
    const variety = (r.variety || 'Apple').trim();
    const date = r.arrival_date || '';
    const min = Number(r.min_price);
    const max = Number(r.max_price);
    const modal = Number(r.modal_price);
    if (!Number.isFinite(modal)) continue;

    byMandi[mandi] = byMandi[mandi] || { district, varieties: {} };

    const existing = byMandi[mandi].varieties[variety];
    // Keep only the most recent date's record per mandi+variety
    if (!existing || new Date(date) > new Date(existing.date)) {
      byMandi[mandi].varieties[variety] = { min, max, modal, date };
    }
  }
  return byMandi;
}

async function loadPrevious() {
  try {
    const raw = await readFile(OUTPUT_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null; // first run ever, or file doesn't exist yet
  }
}

function attachTrend(current, previous) {
  if (!previous || !previous.mandis) return current;
  for (const [mandi, info] of Object.entries(current.mandis)) {
    const prevMandi = previous.mandis[mandi];
    if (!prevMandi) continue;
    for (const [variety, v] of Object.entries(info.varieties)) {
      const prevV = prevMandi.varieties && prevMandi.varieties[variety];
      // Don't compare a day against itself if the API hasn't updated yet
      if (prevV && prevV.date !== v.date) {
        v.prevModal = prevV.modal;
        v.prevDate = prevV.date;
      } else if (prevV && prevV.prevModal !== undefined) {
        // API didn't refresh today — carry the last known trend forward
        v.prevModal = prevV.prevModal;
        v.prevDate = prevV.prevDate;
      }
    }
  }
  return current;
}

async function main() {
  console.log('Fetching Kashmir apple mandi prices…');
  const records = await fetchAllRecords();
  console.log(`Got ${records.length} raw records from Agmarknet.`);

  const byMandi = groupRecords(records);
  let result = {
    updated: new Date().toISOString(),
    source: 'Agmarknet (data.gov.in) — Ministry of Agriculture & Farmers Welfare, Govt. of India',
    mandis: byMandi,
  };

  const previous = await loadPrevious();
  result = attachTrend(result, previous);

  await writeFile(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`Wrote ${Object.keys(byMandi).length} mandis to mandi-prices.json`);
}

main().catch((err) => {
  console.error('Failed to update mandi prices:', err);
  // Exit 0 (not 1) so a temporary Agmarknet outage doesn't break the
  // GitHub Actions workflow or overwrite yesterday's good data — the
  // site will just keep showing the last successfully fetched prices.
  process.exit(0);
});
