import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const affiliates = [
  { id: 504, name: "Lehigh Valley IronPigs" },
  { id: 522, name: "Reading Fightin Phils" },
  { id: 537, name: "Jersey Shore BlueClaws" },
  { id: 566, name: "Clearwater Threshers" },
  { id: 570, name: "FCL Phillies" }
];

const isInjuredStatus = (status = "") => /injured list|disabled list/i.test(status);

async function fetchAffiliateRoster(affiliate) {
  const source = `https://statsapi.mlb.com/api/v1/teams/${affiliate.id}/roster?rosterType=fullRoster&hydrate=person`;
  const response = await fetch(source, {
    headers: { "User-Agent": "Phillies-Prospect-Pulse/1.0" }
  });

  if (!response.ok) {
    throw new Error(`${affiliate.name}: MLB roster request failed (${response.status})`);
  }

  const payload = await response.json();
  const roster = Array.isArray(payload.roster) ? payload.roster : [];

  return roster
    .filter((entry) => isInjuredStatus(entry?.status?.description))
    .map((entry) => {
      const status = entry.status.description;
      return {
        playerId: entry.person?.id ?? null,
        player: entry.person?.fullName ?? "Unknown player",
        affiliate: affiliate.name,
        injury: "Not publicly specified",
        timeline: `${status}; no public return date`,
        status,
        source,
        lastUpdated: new Date().toISOString()
      };
    });
}

async function main() {
  const results = await Promise.allSettled(affiliates.map(fetchAffiliateRoster));
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

  console.log(`Saved ${records.length} injury records.`);
  if (errors.length) console.warn("Some affiliate feeds failed:", errors);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
