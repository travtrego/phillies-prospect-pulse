'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type RankingRecord = {
  playerId:string;
  player:string;
  position:string|null;
  affiliate:string|null;
  level:string|null;
  score:number;
  previousRank:number|null;
  rank:number;
  change:number;
  mediaMentions:number;
  reasons:string[];
  intelligence:{
    modelVersion:string;
    confidence:'high'|'moderate'|'low';
    confidenceScore:number;
    consensusRank:number|null;
    consensusDifference:number|null;
    consensusAgreement:number|null;
    externalSourceCount:number;
    limitations:string[];
  };
};

export default function RankingsTable({records}:{records:RankingRecord[]}){
 const[search,setSearch]=useState('');
 const[sort,setSort]=useState<'rank'|'score'|'change'|'confidence'>('rank');
 const visible=useMemo(()=>{
  const query=search.trim().toLowerCase();
  return [...records].filter(record=>!query||record.player.toLowerCase().includes(query)||(record.position??'').toLowerCase().includes(query)||(record.level??'').toLowerCase().includes(query)||(record.affiliate??'').toLowerCase().includes(query)).sort((a,b)=>sort==='score'?b.score-a.score:sort==='change'?b.change-a.change:sort==='confidence'?b.intelligence.confidenceScore-a.intelligence.confidenceScore:a.rank-b.rank);
 },[records,search,sort]);
 return <>
  <section className="directoryToolbar rankingsToolbar"><div className="filterTabs" role="tablist" aria-label="Sort rankings"><button type="button" role="tab" aria-selected={sort==='rank'} className={sort==='rank'?'active':''} onClick={()=>setSort('rank')}>Current rank</button><button type="button" role="tab" aria-selected={sort==='score'} className={sort==='score'?'active':''} onClick={()=>setSort('score')}>Pulse score</button><button type="button" role="tab" aria-selected={sort==='change'} className={sort==='change'?'active':''} onClick={()=>setSort('change')}>Movement</button><button type="button" role="tab" aria-selected={sort==='confidence'} className={sort==='confidence'?'active':''} onClick={()=>setSort('confidence')}>Confidence</button></div><input aria-label="Search rankings" placeholder="Search player, team or level…" value={search} onChange={event=>setSearch(event.target.value)}/></section>
  <div className="rankingTableWrap"><table className="rankingTable"><thead><tr><th>Rank</th><th>Player</th><th>Pos.</th><th>Level</th><th>Affiliate</th><th>Previous</th><th>Trend</th><th>Score</th><th>Confidence</th><th>Consensus</th></tr></thead><tbody>
   {visible.map(record=>{const trend=record.change>0?`▲ ${record.change}`:record.change<0?`▼ ${Math.abs(record.change)}`:'—';const trendClass=record.change>0?'trendUp':record.change<0?'trendDown':'trendFlat';const consensus=record.intelligence.consensusRank===null?'—':`#${record.intelligence.consensusRank}`;return <tr key={record.playerId}>
    <td><strong className="rankingNumber">#{record.rank}</strong></td>
    <td><Link className="rankingPlayer" href={`/players/${record.playerId}`}>{record.player}</Link></td>
    <td>{record.position??'—'}</td><td>{record.level??'—'}</td><td>{record.affiliate??'—'}</td><td>{record.previousRank?`#${record.previousRank}`:'New'}</td><td><span className={trendClass}>{trend}</span></td><td><strong>{record.score.toFixed(1)}</strong></td><td title={`${record.intelligence.confidenceScore}% data confidence; ${record.intelligence.limitations.join(' ')}`}>{record.intelligence.confidence} · {record.intelligence.confidenceScore}%</td><td title={record.intelligence.externalSourceCount?`${record.intelligence.externalSourceCount} external observations`:'No external observations loaded'}>{consensus}</td>
   </tr>})}
   {visible.length===0&&<tr><td colSpan={10}>No rankings match this search.</td></tr>}
  </tbody></table></div>
 </>;
}
