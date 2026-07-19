import injuryFeed from "../../data/injuries.json";
import InjuryReport from "./InjuryReport";

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

function formatUpdatedAt(value: string | null) {
  if (!value) return "Waiting for first daily refresh";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

export default function InjuriesPage() {
  const records = injuryFeed.records as InjuryRecord[];

  return (
    <main>
      <header className="pageHeader">
        <span className="eyebrow">Player availability</span>
        <h1>Injuries</h1>
        <p>A daily report of injured Phillies minor leaguers, filtered by affiliate and position and enriched with specific injury reporting when a matching news source is available.</p>
      </header>

      <section className="movementPagePanel">
        <div className="panelHeading">
          <div>
            <span className="eyebrow">Current status</span>
            <h2>Injury report</h2>
          </div>
          <span className="dataStatusPill">Updated daily</span>
        </div>

        <p className="muted">Last refreshed: {formatUpdatedAt(injuryFeed.updatedAt)}</p>

        {records.length === 0 ? (
          <div className="emptyStateCompact">
            <strong>No injury records loaded yet</strong>
            <p>Run the daily injury update to populate this page from official transactions and matching news reports.</p>
          </div>
        ) : (
          <InjuryReport records={records} />
        )}
      </section>
    </main>
  );
}
