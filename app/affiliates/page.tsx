import Link from 'next/link';
import injuryFeed from '../../data/injuries.json';
import { getDirectoryPlayers } from '../../lib/playerDirectory';

type InjuryRecord = {playerId:number|null;player:string;affiliate:string;injury:string;timeline:string;status:string;source:string;transactionDate?:string|null;lastUpdated:string};
const levels=[['AAA','Lehigh Valley IronPigs','Triple-A'],['AA','Reading Fightin Phils','Double-A'],['A+','Jersey Shore BlueClaws','High-A'],['A','Clearwater Threshers','Single-A']] as const;

export default async function AffiliatesPage(){
 const players=await getDirectoryPlayers();
 const injuries=injuryFeed.records as InjuryRecord[];
 return <main>
  <header className="pageHeader"><span className="eyebrow">Organizational depth</span><h1>Affiliates</h1><p>Roster composition, prospect concentration and current injury information across the full-season system.</p></header>
  <section className="affiliateGrid">{levels.map(([level,team,label])=>{
   const roster=players.filter(player=>player.current_level===level);
   const ranked=roster.filter(player=>player.mlb_pipeline_rank!==null).sort((a,b)=>(a.mlb_pipeline_rank??999)-(b.mlb_pipeline_rank??999));
   const teamInjuries=injuries.filter(record=>record.affiliate===team);
   return <article className="affiliateCard" key={level}>
    <div className="affiliateTop"><span>{level}</span><div><small>{label}</small><h2>{team}</h2></div></div>
    <div className="affiliateMetrics"><div><span>Tracked roster</span><strong>{roster.length}</strong></div><div><span>Top 30</span><strong>{ranked.length}</strong></div><div><span>Injured</span><strong>{teamInjuries.length}</strong></div></div>
    <div className="affiliateProspects"><span>Highest-ranked prospects</span>{ranked.slice(0,4).map(player=><Link href={`/players/${player.id}`} key={player.id}><b>#{player.mlb_pipeline_rank}</b>{player.full_name}</Link>)}{ranked.length===0&&<p>No ranked players currently assigned.</p>}</div>
    <div className="affiliateProspects"><span>Injury report</span>{teamInjuries.map(record=><a href={record.source} target="_blank" rel="noreferrer" key={`${record.playerId??record.player}-${record.timeline}`}><b>{record.player}</b>{record.timeline}</a>)}{teamInjuries.length===0&&<p>No active injuries found in the latest official transaction update.</p>}</div>
   </article>})}</section>
 </main>;
}
