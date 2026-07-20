import Link from 'next/link';
import injuryFeed from '../../data/injuries.json';
import statsData from '../../data/stats.json';
import { getDirectoryPlayers } from '../../lib/playerDirectory';

type InjuryRecord={playerId:number|null;player:string;affiliate:string;injury:string;timeline:string;status:string;source:string;transactionDate?:string|null;lastUpdated:string};
type StatRecord={playerId:number;player:string;affiliate:string;level:string;position:string;stats:{type:string;ops?:number|null;homeRuns?:number|null;stolenBases?:number|null;era?:number|null;strikeouts?:number|null;inningsPitched?:string|null}};
const levels=[['AAA','Lehigh Valley IronPigs','Triple-A'],['AA','Reading Fightin Phils','Double-A'],['A+','Jersey Shore BlueClaws','High-A'],['A','Clearwater Threshers','Single-A'],['Rookie','FCL Phillies','Rookie']] as const;
function best<T>(records:T[],score:(record:T)=>number){return [...records].sort((a,b)=>score(b)-score(a))[0]}

export default async function AffiliatesPage(){
 const players=await getDirectoryPlayers();
 const injuries=injuryFeed.records as InjuryRecord[];
 const stats=statsData.records as StatRecord[];
 return <main>
  <header className="pageHeader"><span className="eyebrow">Organizational depth</span><h1>Affiliates</h1><p>Current active-roster composition, prospect concentration, statistical leaders and injury information across the Phillies system.</p></header>
  <section className="affiliateGrid">{levels.map(([level,team,label])=>{
   const roster=players.filter(player=>player.current_level===level).sort((a,b)=>(a.mlb_pipeline_rank??999)-(b.mlb_pipeline_rank??999)||a.full_name.localeCompare(b.full_name));
   const ranked=roster.filter(player=>player.mlb_pipeline_rank!==null);
   const teamInjuries=injuries.filter(record=>record.affiliate===team);
   const teamStats=stats.filter(record=>record.affiliate===team);
   const hitters=teamStats.filter(record=>record.stats.type==='hitting');
   const pitchers=teamStats.filter(record=>record.stats.type==='pitching');
   const opsLeader=best(hitters,record=>record.stats.ops??-1);
   const hrLeader=best(hitters,record=>record.stats.homeRuns??-1);
   const eraLeader=[...pitchers].filter(record=>(record.stats.inningsPitched?Number(record.stats.inningsPitched):0)>0).sort((a,b)=>(a.stats.era??999)-(b.stats.era??999))[0];
   return <article className="affiliateCard" key={level}>
    <div className="affiliateTop"><span>{level}</span><div><small>{label}</small><h2>{team}</h2></div></div>
    <div className="affiliateMetrics"><div><span>Active roster</span><strong>{roster.length}</strong></div><div><span>Top 30</span><strong>{ranked.length}</strong></div><div><span>Injury notes</span><strong>{teamInjuries.length}</strong></div></div>
    <div className="affiliateLeaderGrid"><div><span>OPS leader</span><strong>{opsLeader?`${opsLeader.player} · ${opsLeader.stats.ops?.toFixed(3).replace(/^0/,'')}`:'—'}</strong></div><div><span>HR leader</span><strong>{hrLeader?`${hrLeader.player} · ${hrLeader.stats.homeRuns}`:'—'}</strong></div><div><span>ERA leader</span><strong>{eraLeader?`${eraLeader.player} · ${eraLeader.stats.era?.toFixed(2)}`:'—'}</strong></div></div>
    <div className="affiliateProspects"><span>Roster snapshot</span><div className="affiliateRoster">{roster.slice(0,8).map(player=><Link href={`/players/${player.id}`} key={player.id}><b>{player.mlb_pipeline_rank?`#${player.mlb_pipeline_rank}`:'—'}</b><span>{player.full_name}</span><small>{player.primary_position??'—'}</small></Link>)}</div>{roster.length>8&&<p>Showing 8 of {roster.length} active players. Use the dashboard directory to filter the full roster.</p>}{roster.length===0&&<p>No active players currently returned for this affiliate.</p>}</div>
    <div className="affiliateProspects"><span>Injury report</span>{teamInjuries.slice(0,4).map(record=><a href={record.source} target="_blank" rel="noreferrer" key={`${record.playerId??record.player}-${record.timeline}`}><b>{record.player}</b>{record.timeline}</a>)}{teamInjuries.length===0&&<p>No active injuries found in the latest verified update.</p>}</div>
   </article>})}</section>
 </main>;
}
