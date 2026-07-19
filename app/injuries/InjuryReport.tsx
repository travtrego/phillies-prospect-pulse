"use client";

import { useMemo, useState } from "react";
import "./injuries.css";

type InjuryRecord = {
  playerId: number | null;
  player: string;
  affiliate: string;
  position?: string;
  injury: string;
  timeline: string;
  status: string;
  source: string;
  newsSource?: string;
  newsHeadline?: string;
  injuryConfidence?: "high" | "medium" | "low";
  injurySourceType?: "verified-registry" | "news-feed" | "historical-search" | "official-transaction";
  lastUpdated: string;
};

type Props = {
  records: InjuryRecord[];
};

type InjuryTier = "verified" | "reported" | "undisclosed";

const affiliateOrder: Record<string, number> = {
  "Lehigh Valley IronPigs": 0,
  "Reading Fightin Phils": 1,
  "Jersey Shore BlueClaws": 2,
  "Clearwater Threshers": 3,
  "FCL Phillies": 4
};

function getTier(record: InjuryRecord): InjuryTier {
  if (record.injurySourceType === "verified-registry") return "verified";
  if (record.injury !== "Not publicly disclosed" && record.newsSource) return "reported";
  return "undisclosed";
}

const tierOrder: Record<InjuryTier, number> = {
  verified: 0,
  reported: 1,
  undisclosed: 2
};

const tierLabel: Record<InjuryTier, string> = {
  verified: "Verified",
  reported: "Reported",
  undisclosed: "Undisclosed"
};

export default function InjuryReport({ records }: Props) {
  const [affiliate, setAffiliate] = useState("All affiliates");
  const [position, setPosition] = useState("All positions");

  const affiliates = useMemo(
    () => ["All affiliates", ...Array.from(new Set(records.map((record) => record.affiliate))).sort()],
    [records]
  );

  const positions = useMemo(
    () => ["All positions", ...Array.from(new Set(records.map((record) => record.position ?? "Unknown"))).sort()],
    [records]
  );

  const filtered = useMemo(() => {
    return records
      .filter((record) => {
        const affiliateMatch = affiliate === "All affiliates" || record.affiliate === affiliate;
        const positionMatch = position === "All positions" || (record.position ?? "Unknown") === position;
        return affiliateMatch && positionMatch;
      })
      .sort((a, b) => {
        const tierDifference = tierOrder[getTier(a)] - tierOrder[getTier(b)];
        if (tierDifference !== 0) return tierDifference;

        const affiliateDifference = (affiliateOrder[a.affiliate] ?? 99) - (affiliateOrder[b.affiliate] ?? 99);
        if (affiliateDifference !== 0) return affiliateDifference;

        return a.player.localeCompare(b.player);
      });
  }, [records, affiliate, position]);

  const counts = useMemo(() => {
    return filtered.reduce(
      (totals, record) => {
        totals[getTier(record)] += 1;
        return totals;
      },
      { verified: 0, reported: 0, undisclosed: 0 }
    );
  }, [filtered]);

  return (
    <>
      <div className="injurySummary" aria-label="Injury report summary">
        <div>
          <span>Active injuries</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="summaryBreakdown">
          <span className="summaryPill verified">Verified {counts.verified}</span>
          <span className="summaryPill reported">Reported {counts.reported}</span>
          <span className="summaryPill undisclosed">Undisclosed {counts.undisclosed}</span>
        </div>
      </div>

      <div className="injuryFilters">
        <label>
          <span>Affiliate</span>
          <select value={affiliate} onChange={(event) => setAffiliate(event.target.value)}>
            {affiliates.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <label>
          <span>Position</span>
          <select value={position} onChange={(event) => setPosition(event.target.value)}>
            {positions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <strong>{filtered.length} players</strong>
      </div>

      {filtered.length === 0 ? (
        <div className="emptyStateCompact">
          <strong>No injuries match these filters</strong>
          <p>Choose a different affiliate or position.</p>
        </div>
      ) : (
        <div className="movementList">
          {filtered.map((record) => {
            const tier = getTier(record);
            return (
              <article className={`movementCard ${tier}`} key={`${record.affiliate}-${record.playerId ?? record.player}`}>
                <div className="injuryCardHeader">
                  <div>
                    <span className="eyebrow">{record.affiliate} · {record.position ?? "Unknown"}</span>
                    <h3>{record.player}</h3>
                  </div>
                  <span className={`injuryBadge ${tier}`}>{tierLabel[tier]}</span>
                </div>
                <p><strong>Injury:</strong> {record.injury}</p>
                <p><strong>Timeline:</strong> {record.timeline}</p>
                {record.newsHeadline && <p><strong>Report:</strong> {record.newsHeadline}</p>}
                <a href={record.newsSource ?? record.source} target="_blank" rel="noreferrer">
                  {record.newsSource ? "News injury source →" : "Official transaction source →"}
                </a>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
