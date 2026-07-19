import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const organizationTeams = [
  { name: "Philadelphia Phillies", level: "MLB", rank: 5 },
  { name: "Lehigh Valley IronPigs", level: "AAA", rank: 4 },
  { name: "Reading Fightin Phils", level: "AA", rank: 3 },
  { name: "Jersey Shore BlueClaws", level: "High-A", rank: 2 },
  { name: "Clearwater Threshers", level: "Single-A", rank: 1 },
  { name: "FCL Phillies", level: "Rookie", rank: 0 }
];

const isoDate = (date) => date.toISOString().slice(0, 10);
const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9]/g, "");

async function resolveTeams() {
  const response = await fetch("https://statsapi.mlb.com/api/v1/teams?sportIds=1,11,12,13,14,16", {
    headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" }
  });
  if (!response.ok) throw new Error(`Team lookup failed (${response.status})`);

  const teams = (await response.json()).teams ?? [];
  return organizationTeams.map((configured) => {
    const team = teams.find((candidate) => candidate.name === configured.name);
    if (!team) throw new Error(`Could not resolve official team ID for ${configured.name}`);
    return { ...configured, id: team.id };
  });
}

function teamFromText(description, teams) {
  return teams.find((team) => description.toLowerCase().includes(team.name.toLowerCase())) ?? null;
}

function extractMove(transaction, sourceTeam, teams, sourceUrl) {
  const description = transaction.description ?? "";
  if (!/assigned|selected|recalled|transferred|optioned|contract/i.test(description)) return null;
  if (/injured list|disabled list|development list|rehab assignment/i.test(description)) return null;

  const explicitFrom = transaction.fromTeam?.id
    ? teams.find((team) => team.id === transaction.fromTeam.id)
    : null;
  const explicitTo = transaction.toTeam?.id
    ? teams.find((team) => team.id === transaction.toTeam.id)
    : null;

  let fromTeam = explicitFrom;
  let toTeam = explicitTo;

  if (!fromTeam || !toTeam) {
    const mentioned = teams.filter((team) => description.toLowerCase().includes(team.name.toLowerCase()));
    if (!fromTeam && mentioned.length > 1) fromTeam = mentioned[0];
    if (!toTeam && mentioned.length > 1) toTeam = mentioned[mentioned.length - 1];
  }

  if (!toTeam && sourceTeam && /assigned|selected|recalled|transferred/i.test(description)) {
    toTeam = sourceTeam;
  }

  if (!fromTeam) {
    const fromMatch = description.match(/from the?\s+(.+?)(?:\.|$)/i);
    if (fromMatch) fromTeam = teamFromText(fromMatch[1], teams);
  }

  if (!toTeam) {
    const toMatch = description.match(/to the?\s+(.+?)(?:\.|$)/i);
    if (toMatch) toTeam = teamFromText(toMatch[1], teams);
  }

  if (!fromTeam || !toTeam || fromTeam.id === toTeam.id || toTeam.rank <= fromTeam.rank) return null;

  const player = transaction.person?.fullName ?? description.split(/ assigned| selected| recalled| transferred| optioned/i)[0].trim();
  if (!player) return null;

  return {
    playerId: transaction.person?.id ?? null,
    player,
    date: transaction.effectiveDate ?? transaction.date ?? null,
    fromAffiliate: fromTeam.name,
    fromLevel: fromTeam.level,
    toAffiliate: toTeam.name,
    toLevel: toTeam.level,
    description,
    source: sourceUrl
  };
}

async function fetchTransactions(team, teams, start, end) {
  const source = `https://statsapi.mlb.com/api/v1/transactions?teamId=${team.id}&startDate=${isoDate(start)}&endDate=${isoDate(end)}`;
  const response = await fetch(source, { headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" } });
  if (!response.ok) throw new Error(`${team.name}: transaction request failed (${response.status})`);
  const transactions = (await response.json()).transactions ?? [];
  return transactions.map((transaction) => extractMove(transaction, team, teams, source)).filter(Boolean);
}

async function main() {
  const teams = await resolveTeams();
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);

  const affiliateTeams = teams.filter((team) => team.level !== "MLB");
  const results = await Promise.allSettled(affiliateTeams.map((team) => fetchTransactions(team, teams, start, end)));
  const promotions = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") promotions.push(...result.value);
    else errors.push({ affiliate: affiliateTeams[index].name, error: result.reason?.message ?? String(result.reason) });
  });

  const unique = new Map();
  for (const promotion of promotions) {
    const key = [promotion.playerId ?? normalize(promotion.player), promotion.date, promotion.fromLevel, promotion.toLevel].join("-");
    if (!unique.has(key)) unique.set(key, promotion);
  }

  const records = [...unique.values()]
    .sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0) || a.player.localeCompare(b.player))
    .slice(0, 250);

  const outputDir = path.join(process.cwd(), "data");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "promotions.json"),
    `${JSON.stringify({ updatedAt: new Date().toISOString(), records, errors }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Saved ${records.length} Phillies promotions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
