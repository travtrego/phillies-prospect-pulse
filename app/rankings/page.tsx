import RankingsTable, { type RankingRecord } from './RankingsTable';
import rankingsData from '../../data/rankings.json';
import externalData from '../../data/external-rankings.json';
import { enrichRankings } from '../../lib/ranking/intelligence';
import { RANKING_MODEL_VERSION } from '../../lib/ranking/model';
import './rankings.css';

function formatDate(value:string|null){if(!value)return'Not yet available';const date=new Date(value);if(Number.isNaN(date.getTime()))return'Update pending';return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(date)}

export default function RankingsPage(){
 const records=enrichRankings().slice(0,30).sort((a,b)=>a.rank-b.rank) as RankingRecord[];
 const risers=[...records].filter(record=>record.change>0).sort((a,b)=>b.change-a.change).slice(0,3);
 const fallers=[...records].filter(record=>record.change<0).sort((a,b)=>a.change-b.change).slice(0,3);
 const externalCount=(externalData.records||[]).length;
 const highConfidence=records.filter(record=>record.intelligence.confidence==='high').length;
 return <main>
  <header className="pageHeader rankingsHeader"><span className="eyebrow">Prospect Pulse rankings</span><h1>Phillies Top 30</h1><p>Model v{RANKING_MODEL_VERSION} blends scouting, performance, age and level, development, media sentiment, movement, availability and optional defensive, pitch-quality, historical and external-consensus evidence. Updated {formatDate(rankingsData.updatedAt)}.</p></header>
  <section className="rankingSummaryGrid">
   <article><span>Ranked prospects</span><strong>{records.length}</strong><p>One shared Top 30 powers this page and the homepage.</p></article>
   <article><span>High-confidence ranks</span><strong>{highConfidence}</strong><p>Confidence reflects core and optional data coverage.</p></article>
   <article><span>External observations</span><strong>{externalCount}</strong><p>{externalCount?'Consensus validation is active.':'Optional external validation feed is not populated yet.'}</p></article>
  </section>
  {(risers.length>0||fallers.length>0)&&<section className="moversGrid"><article className="moverPanel"><span className="eyebrow">Trending up</span><h2>Biggest risers</h2>{risers.length?risers.map(record=><p key={record.playerId}><strong>#{record.rank} {record.player}</strong><span>▲ {record.change}</span></p>):<p>No positive movement in the latest snapshot.</p>}</article><article className="moverPanel"><span className="eyebrow">Trending down</span><h2>Biggest fallers</h2>{fallers.length?fallers.map(record=><p key={record.playerId}><strong>#{record.rank} {record.player}</strong><span>▼ {Math.abs(record.change)}</span></p>):<p>No negative movement in the latest snapshot.</p>}</article></section>}
  <div className="resultsHeader"><div><span className="eyebrow">Current board</span><h2>Top 30 rankings</h2></div><span className="status">Model v{RANKING_MODEL_VERSION}</span></div>
  <RankingsTable records={records}/>
  <p className="directoryNote">The model redistributes weight only across available inputs and lowers confidence when defense, pitch quality, historical calibration or external consensus is missing. External rankings are validation evidence, not copied scouting content. Backtesting reports ranking stability and external agreement now; true outcome calibration will improve as archived rankings accumulate against later promotion and MLB outcomes.</p>
 </main>;
}
