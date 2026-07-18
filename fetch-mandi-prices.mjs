#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   fetch-mandi-prices.mjs

   Pulls TODAY'S apple mandi prices for Jammu & Kashmir from the
   Government of India's official Agmarknet dataset (published via
   data.gov.in), and writes them to mandi-prices.json in the repo
   root — the same file index.html already fetches at page load.

   Run manually:   node fetch-mandi-prices.mjs
   Run in CI:       triggered daily by .github/workflows/mandi-prices.yml

   Data source:
   https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi
   Resource ID: 9ef84268-d588-465a-a308-a864a43d0070
   No scraping — this is the real government API, published once a
   day by the Directorate of Marketing & Inspection (DMI).
══════════════════════════════════════════════════════════════ */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';

// A real key is free and instant at https://data.gov.in (register → My Account → API Keys).
// Falls back to the public "test" key so the script still works with zero setup, but that
// key is shared by everyone on the internet and gets rate-limited — set DATA_GOV_IN_API_KEY
// as a GitHub Actions secret as soon as you can.
const API_KEY = process.env.DATA_GOV_IN_API_KEY || '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571';

const STATE = 'Jammu and Kashmir';
const COMMODITY = 'Apple';
const OUTPUT_FILE = new URL('./mandi-prices.json', import.meta.url);

// Districts/markets we care about for an orchard-supply audience around Tral/Pulwama.
// Leave empty to keep every J&K market the API returns.
const MARKET_ALLOWLIST = null; // e.g. ['Sopore', 'Shopian', 'Parimpore', 'Pulwama', 'Pattan']

async function fetchAllRecords() {
  const records = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = new URL(`https://api.data.gov.in/resource/${RESOURCE_ID}`);
    url.searchParams.set('api-key', API_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('filters[state]', STATE);
    url.searchParams.set('filters[commodity]', COMMODITY);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Agmarknet API returned HTTP ${res.status}`);
    }
    const data = await res.json();
    const batch = data.records || [];
    records.push(...batch);

    offset += limit;
    const total = Number(data.total || 0);
    if (batch.length === 0 || offset >= total) break;
  }

  return records;
}

function pickLatestPerMarketVariety(records) {
  // Keep only the most recent arrival_date per (market, variety) pair.
  const latest = new Map();

  for (const r of records) {
    if (MARKET_ALLOWLIST && !MARKET_ALLOWLIST.includes(r.market)) continue;

    // Agmarknet publishes min/max/modal prices in ₹ per QUINTAL (100 kg),
    // but the site displays ₹/kg — so divide by 100 here, once, at the source.
    const min = Number(r.min_price) / 100;
    const max = Number(r.max_price) / 100;
    const modal = Number(r.modal_price) / 100;
    if (!Number.isFinite(modal) || modal <= 0) continue;

    const key = `${r.market}::${r.variety || 'Apple'}`;
    const [dd, mm, yyyy] = String(r.arrival_date).split('/');
    const arrivalTs = yyyy ? new Date(`${yyyy}-${mm}-${dd}`).getTime() : 0;

    const existing = latest.get(key);
    if (!existing || arrivalTs > existing.arrivalTs) {
      latest.set(key, {
        market: r.market,
        district: r.district,
        variety: r.variety || 'Apple',
        min, max, modal,
        arrivalTs,
        arrivalDate: r.arrival_date,
      });
    }
  }

  return [...latest.values()];
}

async function loadPreviousData() {
  if (!existsSync(OUTPUT_FILE)) return null;
  try {
    const raw = await readFile(OUTPUT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildOutput(rows, previous) {
  const mandis = {};

  for (const row of rows) {
    if (!mandis[row.market]) {
      mandis[row.market] = { district: row.district, varieties: {} };
    }
    const round2 = (n) => Math.round(n * 100) / 100;
    const prevModal = previous?.mandis?.[row.market]?.varieties?.[row.variety]?.modal ?? null;
    mandis[row.market].varieties[row.variety] = {
      min: round2(row.min),
      max: round2(row.max),
      modal: round2(row.modal),
      prevModal,
    };
  }

  return {
    updated: new Date().toISOString(),
    source: 'Agmarknet, Govt. of India (data.gov.in)',
    mandis,
  };
}

async function main() {
  console.log(`Fetching ${COMMODITY} prices for ${STATE} from Agmarknet...`);
  const records = await fetchAllRecords();
  console.log(`Received ${records.length} raw records.`);

  const rows = pickLatestPerMarketVariety(records);
  if (rows.length === 0) {
    console.warn('No apple price rows found for today — Agmarknet may not have published J&K apple arrivals yet (common outside peak season, Aug–Nov). Leaving previous file untouched.');
    return;
  }

  const previous = await loadPreviousData();
  const output = buildOutput(rows, previous);

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${Object.keys(output.mandis).length} mandis to mandi-prices.json`);
}

main().catch((err) => {
  console.error('Failed to fetch mandi prices:', err);
  process.exit(1);
});
