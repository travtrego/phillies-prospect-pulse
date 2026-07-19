import RankingsTable, { type RankingRecord } from './RankingsTable';
import rankingsData from '../../data/rankings.json';
import './rankings.css';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Update pending';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export default function RankingsPage() {
  const records = (rankingsData.records as RankingRecord[]).slice(0, 30).sort((a, b) => a.rank - b.rank);
  const risers = [...records].filter((record) => record.change > 0).sort((a, b) => b.change - a.change).slice(0, 3);
  const fallers = [...records].filter((record) => record.change < 0).sort((a, b) => a.change - b.change).slice(0, 3);

  return (
    <main>
      <header className="pageHeader rankingsHeader">
        <span className="eyebrow">Prospect Pulse rankings</span>
        <h1>Phillies Top 30</h1>
        <p>Our automated ranking blends scouting pedigree, current performance, age versus level, recent coverage, movement and availability. Updated {formatDate(rankingsData.updatedAt)}.</p>
      </header>

      <section className="rankingSummaryGrid">
        <article><span>Ranked prospects</span><strong>{records.length}</strong><p>One shared Top 30 powers this page and the homepage.</p></article>
        <article><span>Top score</span><strong>{records[0]?.score.toFixed(1) ?? '—'}</strong><p>{records[0]?.player ?? 'Update pending'}</p></article>
        <article><span>Biggest riser</span><strong>{risers[0] ? `+${risers[0].change}` : '—'}</strong><p>{risers[0]?.player ?? 'No movement yet'}</p></article>
      </section>

      {(risers.length > 0 || fallers.length > 0) && (
        <section className="moversGrid">
          <article className="moverPanel"><span className="eyebrow">Trending up</span><h2>Biggest risers</h2>{risers.length ? risers.map((record) => <p key={record.playerId}><strong>#{record.rank} {record.player}</strong><span>▲ {record.change}</span></p>) : <p>No positive movement in the latest snapshot.</p>}</article>
          <article className="moverPanel"><span className="eyebrow">Trending down</span><h2>Biggest fallers</h2>{fallers.length ? fallers.map((record) => <p key={record.playerId}><strong>#{record.rank} {record.player}</strong><span>▼ {Math.abs(record.change)}</span></p>) : <p>No negative movement in the latest snapshot.</p>}</article>
        </section>
      )}

      <div className="resultsHeader"><div><span className="eyebrow">Current board</span><h2>Top 30 rankings</h2></div><span className="status">Updated daily</span></div>
      <RankingsTable records={records} />
      <p className="directoryNote">Prospect Pulse rankings are an automated editorial model, not a republication of any single outlet's list. The model weights scouting 30%, performance 25%, age versus level 15%, sentiment 15%, movement 10% and risk 5%.</p>
    </main>
  );
}
