import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const affiliateNames = [
  "Lehigh Valley IronPigs",
  "Reading Fightin Phils",
  "Jersey Shore BlueClaws",
  "Clearwater Threshers",
  "FCL Phillies"
];

const placedOnIl = /placed .* on (?:the )?(?:(\d+)-day |full-season )?(?:injured|disabled) list|assigned .* to (?:the )?(?:(\d+)-day |full-season )?(?:injured|disabled) list/i;
const removedFromIl = /activated|reinstated|returned from .*?(?:injured|disabled) list|transferred .* from .*?(?:injured|disabled) list|released|retired/i;
const positionPattern = /\b(RHP|LHP|P|C|1B|2B|3B|SS|LF|CF|RF|OF|INF|UTIL|DH)\b/;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeTimeline(description) {
  const dayMatch = description.match(/(\d+)-day (?:injured|disabled) list/i);
  if (dayMatch) return `${dayMatch[1]}-day injured list; no public return date`;
  if (/full-season (?:injured|disabled) list/i.test(description)) return "Full-season injured list; no public return date";
  return "Injured list; no public return date";
}

function extractPosition(description) {
  return description.match(positionPattern)?.[1] ?? "Unknown";
}

async function resolveAffiliates() {
  const url = "https://statsapi.mlb.com/api/v1/teams?sportIds=11,12,13,14,16";
  const response = await fetch(url, { headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" } });
  if (!response.ok) throw new Error(`Affiliate lookup failed (${response.status})`);
  const payload = await response.json();
  const teams = Array.isArray(payload.teams) ? payload.teams : [];

  return affiliateNames.map((name) => {
    const team = teams.find((candidate) => candidate.name === name);
    if (!team) throw new Error(`Could not resolve official team ID for ${name}`);
    return { id: team.id, name };
  });
}

async function fetchPlayerPosition(playerId, fallback) {
  if (!playerId) return fallback;

  try {
    const response = await fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}`, {
      headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" }
    });
    if (!response.ok) return fallback;
    const payload = await response.json();
    const person = payload.people?.[0];
    return person?.primaryPosition?.abbreviation ?? person?.primaryPosition?.name ?? fallback;
  } catch {
    return fallback;
  }
}

async function loadNewsUniverse() {
  try {
    const file = await readFile(path.join(process.cwd(), "data", "news.json"), "utf8");
    const payload = JSON.parse(file);
    return Array.isArray(payload.articles) ? payload.articles : [];
  } catch (error) {
    console.warn("Could not load shared news universe:", error.message);
    return [];
  }
}

function findNewsInjury(record, articles) {
  const playerName = record.player.toLowerCase();
  const affiliateName = record.affiliate.toLowerCase();

  const matches = articles
    .filter((article) => article.injury)
    .filter((article) => {
      const text = `${article.title ?? ""} ${article.summary ?? ""}`.toLowerCase();
      return text.includes(playerName);
    })
    .map((article) => {
      const text = `${article.title ?? ""} ${article.summary ?? ""}`.toLowerCase();
      let score = 3;
      if (text.includes(affiliateName)) score += 2;
      if ((article.tags ?? []).includes("injury")) score += 2;
      if ((article.tags ?? []).includes("rehab")) score += 1;
      return { article, score };
    })
    .sort((a, b) => b.score - a.score || new Date(b.article.publishedAt ?? 0) - new Date(a.article.publishedAt ?? 0));

  const best = matches[0]?.article;
  if (!best) return null;

  return {
    injury: best.injury,
    newsSource: best.url,
    newsHeadline: best.title,
    newsPublishedAt: best.publishedAt ?? null,
    injuryConfidence: matches[0].score >= 7 ? "high" : "medium"
  };
}

async function fetchAffiliateTransactions(affiliate) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);

  const source = `https://statsapi.mlb.com/api/v1/transactions?teamId=${affiliate.id}&startDate=${isoDate(start)}&endDate=${isoDate(end)}`;
  const response = await fetch(source, { headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" } });
  if (!response.ok) throw new Error(`${affiliate.name}: transaction request failed (${response.status})`);

  const payload = await response.json();
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const current = new Map();

  transactions
    .sort((a, b) => new Date(a.effectiveDate ?? a.date ?? 0) - new Date(b.effectiveDate ?? b.date ?? 0))
    .forEach((transaction) => {
      const description = transaction.description ?? "";
      const playerId = transaction.person?.id ?? null;
      const fallbackPlayer = description.split(" ").slice(0, 3).join(" ");
      const player = transaction.person?.fullName ?? (fallbackPlayer || "Unknown player");
      const key = playerId ? String(playerId) : player.toLowerCase();

      if (placedOnIl.test(description)) {
        current.set(key, {
          playerId,
          player,
          affiliate: affiliate.name,
          position: extractPosition(description),
          injury: "Not publicly disclosed",
          timeline: normalizeTimeline(description),
          status: description,
          source,
          transactionDate: transaction.effectiveDate ?? transaction.date ?? null,
          lastUpdated: new Date().toISOString()
        });
      } else if (removedFromIl.test(description)) {
        current.delete(key);
      }
    });

  return [...current.values()];
}

async function main() {
  const affiliates = await resolveAffiliates();
  const newsArticles = await loadNewsUniverse();
  const results = await Promise.allSettled(affiliates.map(fetchAffiliateTransactions));
  const records = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") records.push(...result.value);
    else errors.push({ affiliate: affiliates[index].name, error: result.reason?.message ?? String(result.reason) });
  });

  for (const record of records) {
    record.position = await fetchPlayerPosition(record.playerId, record.position);
    const newsMatch = findNewsInjury(record, newsArticles);
    if (newsMatch) Object.assign(record, newsMatch);
  }

  records.sort((a, b) => a.affiliate.localeCompare(b.affiliate) || a.player.localeCompare(b.player));

  const output = { updatedAt: new Date().toISOString(), records, errors };
  const outputDir = path.join(process.cwd(), "data");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "injuries.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Saved ${records.length} active injury records; ${records.filter((record) => record.newsSource).length} matched from shared news.`);
  if (errors.length) console.warn("Some affiliate transaction feeds failed:", errors);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
