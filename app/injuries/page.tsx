import injuryFeed from "../../data/injuries.json";

type InjuryRecord = {
  playerId: number | null;
  player: string;
  affiliate: string;
  injury: string;
  timeline: string;
  status: string;
  source: string;
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
        <p>A basic daily report of injured Phillies minor leaguers and their publicly available return timelines.</p>
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
            <p>The first scheduled refresh will populate this page from official MLB/MiLB affiliate rosters.</p>
          </div>
        ) : (
          <div className="movementList">
            {records.map((record) => (
              <article className="movementCard" key={`${record.affiliate}-${record.playerId ?? record.player}`}>
                <div>
                  <span className="eyebrow">{record.affiliate}</span>
                  <h3>{record.player}</h3>
                </div>
                <p><strong>Injury:</strong> {record.injury}</p>
                <p><strong>Timeline:</strong> {record.timeline}</p>
                <a href={record.source} target="_blank" rel="noreferrer">Official roster source →</a>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
