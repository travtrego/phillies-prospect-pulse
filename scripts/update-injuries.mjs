import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const affiliates = [
  { id: 504, name: "Lehigh Valley IronPigs" },
  { id: 522, name: "Reading Fightin Phils" },
  { id: 537, name: "Jersey Shore BlueClaws" },
  { id: 566, name: "Clearwater Threshers" },
  { id: 570, name: "FCL Phillies" }
];

const placedOnIl = /placed .* on (?:the )?(?:(\d+)-day |full-season )?(?:injured|disabled) list|assigned .* to (?:the )?(?:(\d+)-day |full-season )?(?:injured|disabled) list/i;
const removedFromIl = /activated|reinstated|returned from .*?(?:injured|disabled) list|transferred .* from .*?(?:injured|disabled) list|released|retired/i;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeTimeline(description) {
  const dayMatch = description.match(/(\d+)-day (?:injured|disabled) list/i);
  if (dayMatch) return `${dayMatch[1]}-day injured list; no public return date`;
  if (/full-season (?:injured|disabled) list/i.test(description)) return "Full-season injured list; no public return date";
  if (/60-day (?:injured|disabled) list/i.test(description)) return "60-day injured list; no public return date";
  return "Injured list; no public return date";
}

async function fetchAffiliateTransactions(affiliate) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);

  const source = `https://statsapi.mlb.com/api/v1/transactions?teamId=${affiliate.id}&startDate=${isoDate(start)}&endDate=${isoDate(end)}`;
  const response = await fetch(source, {
    headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" }
  });

  if (!response.ok) {
    throw new Error(`${affiliate.name}: transaction request failed (${response.status})`);
  }

  const payload = await response.json();
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const current = new Map();

  transactions
    .sort((a, b) => new Date(a.effectiveDate ?? a.date ?? 0) - new Date(b.effectiveDate ?? b.date ?? 0))
    .forEach((transaction) => {
      const description = transaction.description ?? "";
      const playerId = transaction.person?.id ?? null;
      const player = transaction.person?.fullName ?? description.split(" ").slice(0, 3).join(" ") || "Unknown player";
      const key = playerId ? String(playerId) : player.toLowerCase();

      if (placedOnIl.test(description)) {
        current.set(key, {
          playerId,
          player,
          affiliate: affiliate.name,
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
  const results = await Promise.allSettled(affiliates.map(fetchAffiliateTransactions));
  const records = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      records.push(...result.value);
    } else {
      errors.push({ affiliate: affiliates[index].name, error: result.reason?.message ?? String(result.reason) });
    }
  });

  records.sort((a, b) => a.affiliate.localeCompare(b.affiliate) || a.player.localeCompare(b.player));

  const output = {
    updatedAt: new Date().toISOString(),
    records,
    errors
  };

  const outputDir = path.join(process.cwd(), "data");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "injuries.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Saved ${records.length} active injury records from transaction history.`);
  if (errors.length) console.warn("Some affiliate transaction feeds failed:", errors);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
