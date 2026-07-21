import fs from 'node:fs/promises';

const WATCH_FILE = new URL('../data/roster-watch.json', import.meta.url);
const SEASON = new Date().getUTCFullYear();
const CONFIRM_AFTER_HOURS = 18;

const TEAMS = [
  { id: 143, level: 'MLB', rosterType: 'active' },
  { id: 1410, level: 'AAA', rosterType: 'fullRoster' },
  { id: 522, level: 'AA', rosterType: 'fullRoster' },
  { id: 427, level: 'A+', rosterType: 'fullRoster' },
  { id: 566, level: 'A', rosterType: 'fullRoster' },
  { id: 469, level: 'Rookie', rosterType: 'fullRoster' }
];

const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Phillies-Prospect-Pulse/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchOrgRoster() {
  const results = await Promise.allSettled(TEAMS.map(async team => {
    const data = await fetchJson(`https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=${team.rosterType}&season=${SEASON}`);
    return (data.roster || []).map(entry => ({ mlbId: entry.person?.id ?? null, name: entry.person?.fullName ?? '' })).filter(row => row.mlbId && row.name);
  }));
  const rows = [];
  const errors = [];
  for (const result of results) result.status === 'fulfilled' ? rows.push(...result.value) : errors.push(result.reason?.message || String(result.reason));
  return { byId: new Map(rows.map(row => [row.mlbId, row.name])), byName: new Map(rows.map(row => [normalize(row.name), row.mlbId])), errors };
}

async function classifyDeparture(mlbId) {
  try {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 45);
    const isoDate = date => date.toISOString().slice(0, 10);
    const data = await fetchJson(`https://statsapi.mlb.com/api/v1/transactions?playerId=${mlbId}&startDate=${isoDate(start)}&endDate=${isoDate(end)}`);
    const transactions = (data.transactions || []).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    for (const transaction of transactions) {
      const description = `${transaction.typeDesc || ''} ${transaction.description || ''}`;
      if (/trade/i.test(description)) return { status: 'traded', evidence: transaction.description || transaction.typeDesc };
      if (/retire/i.test(description)) return { status: 'retired', evidence: transaction.description || transaction.typeDesc };
      if (/release/i.test(description)) return { status: 'released', evidence: transaction.description || transaction.typeDesc };
    }
  } catch (error) {
    return { status: 'unknown', evidence: `Transaction lookup failed: ${error.message}` };
  }
  return { status: 'unknown', evidence: 'No matching release, trade or retirement transaction found in the official record.' };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.log('Supabase URL or service role key not present; skipping roster reconciliation.');
    return;
  }

  const watch = JSON.parse(await fs.readFile(WATCH_FILE, 'utf8').catch(() => '{}'));
  const org = await fetchOrgRoster();
  if (org.errors.length) console.warn(`Roster fetch had ${org.errors.length} error(s): ${org.errors.join('; ')}`);

  const playersResponse = await fetch(`${url}/rest/v1/players?select=id,full_name,mlb_id&organization_status=eq.active`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!playersResponse.ok) throw new Error(`Supabase read failed: ${playersResponse.status}`);
  const players = await playersResponse.json();

  const idFills = [];
  const confirmed = [];
  const nextWatch = {};
  const now = new Date().toISOString();

  for (const player of players) {
    if (!player.mlb_id) {
      const matchId = org.byName.get(normalize(player.full_name));
      if (matchId) idFills.push({ id: player.id, name: player.full_name, mlbId: matchId });
      continue;
    }
    const stillRostered = org.byId.has(player.mlb_id);
    if (stillRostered) continue;
    const existing = watch[player.id];
    if (!existing) {
      nextWatch[player.id] = { name: player.full_name, missingSince: now };
      continue;
    }
    const missingHours = (Date.now() - new Date(existing.missingSince).getTime()) / 36e5;
    if (missingHours < CONFIRM_AFTER_HOURS) {
      nextWatch[player.id] = existing;
      continue;
    }
    const classification = await classifyDeparture(player.mlb_id);
    confirmed.push({ id: player.id, name: player.full_name, ...classification });
  }

  for (const fill of idFills) {
    const response = await fetch(`${url}/rest/v1/players?id=eq.${fill.id}`, {
      method: 'PATCH',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ mlb_id: fill.mlbId })
    });
    if (!response.ok) console.error(`Failed to set mlb_id for ${fill.name}: ${response.status}`);
  }

  for (const item of confirmed) {
    const response = await fetch(`${url}/rest/v1/players?id=eq.${item.id}`, {
      method: 'PATCH',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ organization_status: item.status, source_last_verified_at: now })
    });
    if (!response.ok) console.error(`Failed to update organization_status for ${item.name}: ${response.status}`);
  }

  await fs.writeFile(WATCH_FILE, `${JSON.stringify(nextWatch, null, 2)}\n`);

  console.log(`Roster reconciliation: ${idFills.length} mlb_id auto-linked, ${confirmed.length} departure(s) confirmed, ${Object.keys(nextWatch).length} player(s) newly or still pending a second check.`);
  for (const fill of idFills) console.log(`LINKED: ${fill.name} -> mlb_id ${fill.mlbId}`);
  for (const item of confirmed) console.log(`DEPARTED (${item.status}): ${item.name} -- ${item.evidence}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
