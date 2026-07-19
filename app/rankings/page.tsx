import rankings from '../../data/rankings.json';
import './rankings.css';

type Ranking = {
  playerId: number | string;
  player: string;
  position?: string;
  affiliate?: string;
  level?: string;
  score: number;
  previousRank: number | null;
  rank: number;
  change: number;
  components: Record<string, number>;
  mediaMentions?: number;
  reasons?: string[];
};

function movement(change: number) {
  if (change > 0) return <span className="rankUp">↑ {change}</span>;
  if (change < 0) return <span className="rankDown">↓ {Math.abs(change)}</span>;
  return <span className="rankEven">—</span>;
}

export default function RankingsPage() {
  const records = rankings.records as Ranking[];
  const updated = rankings.updatedAt ? new Date(rankings.updatedAt).toLocaleString() : 'Waiting for first model run';

  return (
    <main>
      <header className="siteHeader rankingsHeader">
        <div>
          <div className="eyebrow">Prospect Pulse model</div>
          <h1>Phillies prospect rankings</h1>
          <p>A living, transparent ranking built from scouting, performance, age and level, media sentiment, organizational movement and risk.</p>
        </div>
        <div className="headerBadge"><span>Updated</span><strong>{updated}</strong></div>
      </header>

      <section className="rankingMethod">
        {Object.entries(rankings.methodology)
          .filter(([key]) => !['note'].includes(key))
          .map(([key, value]) => (
            <div key={key}><strong>{value}%</strong><span>{key.replace(/([A-Z])/g, ' $1')}</span></div>
          ))}
      </section>

      {records.length === 0 ? (
        <div className="empty">
          <h3>The ranking engine is ready.</h3>
          <p>Run the Daily Prospect Update workflow once to generate the first list.</p>
        </div>
      ) : (
        <section className="rankingList">
          {records.map((item) => (
            <article className="rankingCard" key={item.playerId}>
              <div className="rankNumber">{item.rank}</div>
              <div className="rankingMain">
                <div className="rankingTitleRow">
                  <div>
                    <h2>{item.player}</h2>
                    <p>{[item.position, item.level, item.affiliate].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="rankScore"><strong>{item.score.toFixed(1)}</strong><span>score</span></div>
                </div>

                <div className="rankMovement">
                  <span>Previous rank: {item.previousRank ? `#${item.previousRank}` : 'New'}</span>
                  <span>Current rank: #{item.rank}</span>
                  <span>Change: {movement(item.change)}</span>
                </div>

                <div className="componentGrid">
                  {Object.entries(item.components).map(([name, score]) => (
                    <div key={name}><span>{name.replace(/([A-Z])/g, ' $1')}</span><strong>{score.toFixed(1)}</strong></div>
                  ))}
                </div>

                {(item.reasons?.length || 0) > 0 && (
                  <div className="rankReasons">
                    <strong>Why this rank</strong>
                    <ul>{item.reasons?.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
