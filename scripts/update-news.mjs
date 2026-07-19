import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const queries = [
  "Phillies prospects",
  "Phillies minor leagues",
  "Lehigh Valley IronPigs Phillies",
  "Reading Fightin Phils Phillies",
  "Jersey Shore BlueClaws Phillies",
  "Clearwater Threshers Phillies",
  "FCL Phillies",
  "Phillies prospect injury",
  "Phillies minor league injured list",
  "Phillies prospect rehab assignment"
];

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

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function classify(text) {
  const tags = [];
  if (/(injur|disabled list| IL\b|surgery|strain|sprain|fracture|soreness|inflammation)/i.test(text)) tags.push("injury");
  if (/(promot|called up|selected the contract|assigned to|moved up)/i.test(text)) tags.push("promotion");
  if (/(rehab assignment|began rehab|rehabbing)/i.test(text)) tags.push("rehab");
  if (/(activated|reinstated|returned from the injured list)/i.test(text)) tags.push("activation");
  if (/(transaction|signed|released|claimed|traded)/i.test(text)) tags.push("transaction");
  if (/(home run|strikeout|innings|batting|pitching|prospect of the week)/i.test(text)) tags.push("performance");
  return tags.length ? tags : ["general"];
}

function extractInjury(text) {
  for (const [pattern, label] of injuryPatterns) {
    if (pattern.test(text)) return label;
  }
  return null;
}

async function fetchQuery(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, { headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" } });
  if (!response.ok) throw new Error(`${query}: news request failed (${response.status})`);

  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

  return items.slice(0, 25).map((item) => {
    const title = stripHtml(extractTag(item, "title"));
    const description = stripHtml(extractTag(item, "description"));
    const link = extractTag(item, "link");
    const publishedAt = extractTag(item, "pubDate");
    const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const source = stripHtml(decodeXml(sourceMatch?.[1] ?? "Unknown source"));
    const combined = `${title} ${description}`;

    return {
      id: link || `${title}-${publishedAt}`,
      title,
      summary: description,
      source,
      url: link,
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
      tags: classify(combined),
      injury: extractInjury(combined),
      matchedQuery: query
    };
  });
}

async function main() {
  const results = await Promise.allSettled(queries.map(fetchQuery));
  const articlesById = new Map();
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      result.value.forEach((article) => {
        const key = article.url || article.id;
        if (!articlesById.has(key)) articlesById.set(key, article);
      });
    } else {
      errors.push({ query: queries[index], error: result.reason?.message ?? String(result.reason) });
    }
  });

  const articles = [...articlesById.values()]
    .filter((article) => article.title && article.url)
    .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0))
    .slice(0, 250);

  const output = { updatedAt: new Date().toISOString(), articles, errors };
  const outputDir = path.join(process.cwd(), "data");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "news.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Saved ${articles.length} Phillies prospect news articles.`);
  if (errors.length) console.warn("Some news queries failed:", errors);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
