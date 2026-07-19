import { mkdir, writeFile } from "node:fs/promises";
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
const injuryPatterns = [
  [/(tommy john|ucl tear|ucl surgery|elbow surgery|elbow inflammation|elbow soreness|elbow injury)/i, "Elbow/UCL"],
  [/(shoulder surgery|shoulder inflammation|shoulder soreness|shoulder injury|rotator cuff|labrum)/i, "Shoulder"],
  [/(hamstring strain|hamstring injury|hamstring tightness)/i, "Hamstring"],
  [/(oblique strain|oblique injury)/i, "Oblique"],
  [/(back strain|back injury|lower-back|lower back)/i, "Back"],
  [/(wrist fracture|wrist sprain|wrist injury|wrist surgery)/i, "Wrist"],
  [/(hand fracture|hand injury|finger fracture|finger injury|thumb injury)/i, "Hand/Finger"],
  [/(ankle sprain|ankle injury|ankle fracture)/i, "Ankle"],
  [/(knee surgery|knee injury|acl tear|mcl sprain|meniscus)/i, "Knee"],
  [/(foot injury|foot fracture|toe injury|toe fracture)/i, "Foot/Toe"],
  [/(hip injury|hip strain|groin strain|groin injury)/i, "Hip/Groin"],
  [/(concussion)/i, "Concussion"],
  [/(illness)/i, "Illness"]
];

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1]?.trim() ?? "");
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

function extractInjury(text) {
  for (const [pattern, label] of injuryPatterns) {
    if (pattern.test(text)) return label;
  }
  return null;
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

async function fetchNewsItems(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, { headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" } });
  if (!response.ok) return [];
  const xml = await response.text();
  return xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
}

async function findNewsInjury(record) {
  const queries = [
    `\"${record.player}\" injury Phillies`,
    `\"${record.player}\" injured list`,
    `\"${record.player}\" ${record.affiliate}`
  ];

  try {
    for (const query of queries) {
      const items = await fetchNewsItems(query);

      for (const item of items.slice(0, 12)) {
        const title = extractTag(item, "title");
        const description = extractTag(item, "description").replace(/<[^>]+>/g, " ");
        const link = extractTag(item, "link");
        const publishedAt = extractTag(item, "pubDate");
        const combined = `${title} ${description}`;
        const lower = combined.toLowerCase();
        const injury = extractInjury(combined);

        if (injury && lower.includes(record.player.toLowerCase())) {
          return { injury, newsSource: link, newsHeadline: title, newsPublishedAt: publishedAt || null };
        }
      }
    }
  } catch (error) {
    console.warn(`News lookup failed for ${record.player}:`, error.message);
  }

  return null;
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
  const results = await Promise.allSettled(affiliates.map(fetchAffiliateTransactions));
  const records = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") records.push(...result.value);
    else errors.push({ affiliate: affiliates[index].name, error: result.reason?.message ?? String(result.reason) });
  });

  for (const record of records) {
    record.position = await fetchPlayerPosition(record.playerId, record.position);
    const newsMatch = await findNewsInjury(record);
    if (newsMatch) Object.assign(record, newsMatch);
  }

  records.sort((a, b) => a.affiliate.localeCompare(b.affiliate) || a.player.localeCompare(b.player));

  const output = { updatedAt: new Date().toISOString(), records, errors };
  const outputDir = path.join(process.cwd(), "data");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "injuries.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Saved ${records.length} active injury records; ${records.filter((record) => record.newsSource).length} enriched from news.`);
  if (errors.length) console.warn("Some affiliate transaction feeds failed:", errors);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
