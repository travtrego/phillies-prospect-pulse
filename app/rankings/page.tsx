import RankingsTable, { type RankingRecord } from './RankingsTable';
import rankingsData from '../../data/rankings.json';
import { enrichRankings } from '../../lib/ranking/intelligence';
import { RANKING_MODEL_VERSION } from '../../lib/ranking/model';
import './rankings.css';

function formatDate(value:string|null){if(!value)return'Not yet available';const date=new Date(value);if(Number.isNaN(date.getTime()))return'Update pending';return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(date)}

export default function RankingsPage(){
 const records=enrichRankings().slice(0,30).sort((a,b)=>a.rank-b.rank) as RankingRecord[];
 return <main>
  <header className="pageHeader rankingsHeader"><span className="eyebrow">Prospect Pulse rankings</span><h1>Phillies Top 30</h1><p>Model v{RANKING_MODEL_VERSION} · Updated {formatDate(rankingsData.updatedAt)}</p></header>
  <RankingsTable records={records}/>
 </main>;
}
