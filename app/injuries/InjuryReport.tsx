"use client";

import { useMemo, useState } from "react";

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
  lastUpdated: string;
};

type Props = {
  records: InjuryRecord[];
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

  const filtered = records.filter((record) => {
    const affiliateMatch = affiliate === "All affiliates" || record.affiliate === affiliate;
    const positionMatch = position === "All positions" || (record.position ?? "Unknown") === position;
    return affiliateMatch && positionMatch;
  });

  return (
    <>
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
          {filtered.map((record) => (
            <article className="movementCard" key={`${record.affiliate}-${record.playerId ?? record.player}`}>
              <div>
                <span className="eyebrow">{record.affiliate} · {record.position ?? "Unknown"}</span>
                <h3>{record.player}</h3>
              </div>
              <p><strong>Injury:</strong> {record.injury}</p>
              <p><strong>Timeline:</strong> {record.timeline}</p>
              {record.newsHeadline && <p><strong>Report:</strong> {record.newsHeadline}</p>}
              <a href={record.newsSource ?? record.source} target="_blank" rel="noreferrer">
                {record.newsSource ? "News injury source →" : "Official transaction source →"}
              </a>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
