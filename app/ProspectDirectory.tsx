'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type Player = {
  id:string; full_name:string; primary_position:string|null; current_level:string|null; current_team_name:string|null; mlb_pipeline_rank:number|null; estimated_arrival_year:number|null; bats:string|null; throws:string|null; source_name:string; source_last_verified_at:string|null; scouting_summary:string|null; scouting_grades:Record<string,number>|null; scouting_source_url:string|null; scouting_last_reviewed_at:string|null;
  mlb_id?:number|null; current_age?:number|null; birth_date?:string|null; birth_city?:string|null; birth_state_province?:string|null; birth_country?:string|null; height?:string|null; weight?:number|null; draft_year?:number|null; mlb_debut_date?:string|null; scouting_strengths?:string[]; scouting_concerns?:string[]; scouting_source_label?:string|null;
};
export type HomepageRanking={playerId:string;player:string;rank:number};
const filters=[['top30','Top 30'],['all','All Players'],['AAA','AAA'],['AA','AA'],['A+','High-A'],['A','Single-A'],['pitchers','Pitchers'],['hitters','Position Players']] as const;
const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function initials(name:string){return name.split(' ').filter(Boolean).slice(0,2).map(part=>part[0]).join('')}
function formatDate(value:string|null){if(!value)return'Not yet reviewed';const date=new Date(value);if(Number.isNaN(date.getTime()))return'Not yet reviewed';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date)}
function isPitcher(position:string|null){return['P','RHP','LHP'].includes(position??'')}

export default function ProspectDirectory({players,rankings}:{players:Player[];rankings:HomepageRanking[]}){
 const[filter,setFilter]=useState('top30');
 const[search,setSearch]=useState('');
 const rankById=useMemo(()=>new Map(rankings.map(item=>[String(item.playerId),item.rank])),[rankings]);
 const rankByName=useMemo(()=>new Map(rankings.map(item=>[normalize(item.player),item.rank])),[rankings]);
 const getRank=(player:Player)=>rankById.get(String(player.id))??rankByName.get(normalize(player.full_name))??player.mlb_pipeline_rank??null;
 const top30Players=useMemo(()=>players.filter(player=>{const rank=getRank(player);return rank!==null&&rank<=30}).sort((a,b)=>(getRank(a)??999)-(getRank(b)??999)),[players,rankById,rankByName]);
 const visiblePlayers=useMemo(()=>{const pool=filter==='top30'?top30Players:players;return pool.filter(player=>{const matchesSearch=player.full_name.toLowerCase().includes(search.toLowerCase());if(!matchesSearch)return false;if(filter==='top30'||filter==='all')return true;if(filter==='pitchers')return isPitcher(player.primary_position);if(filter==='hitters')return!isPitcher(player.primary_position);return player.current_level===filter})},[players,top30Players,filter,search]);
 return <>
  <section className="directoryToolbar"><div className="filterTabs" role="tablist" aria-label="Filter prospects">{filters.map(([value,label])=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}</div><input aria-label="Search players" placeholder="Search player…" value={search} onChange={event=>setSearch(event.target.value)}/></section>
  <div className="resultsHeader"><div><span className="eyebrow">Player directory</span><h2>{filters.find(([value])=>value===filter)?.[1]}</h2></div><span className="status">{visiblePlayers.length} players</span></div>
  <section className="cardGrid">{visiblePlayers.map(player=>{const displayRank=getRank(player);const bio=[player.current_age?`Age ${player.current_age}`:null,player.height,player.weight?`${player.weight} lb`:null].filter(Boolean).join(' · ');return <article className="playerCard" key={player.id}>
   <div className="cardTop"><span className="rank">{displayRank?`#${displayRank}`:'Unranked'}</span><span className="level">{player.current_level??'Level unavailable'}</span></div>
   <div className="playerIdentity"><div className="avatar">{initials(player.full_name)}</div><div><h3>{player.full_name}</h3><p>{player.primary_position??'Position unavailable'}{bio?` · ${bio}`:''}</p></div></div>
   <div className="cardDetails"><div><span>Affiliate</span><strong>{player.current_team_name??'Not available'}</strong></div><div><span>Bats / Throws</span><strong>{player.bats??'—'} / {player.throws??'—'}</strong></div><div><span>Draft year</span><strong>{player.draft_year??'Not available'}</strong></div><div><span>Estimated arrival</span><strong>{player.estimated_arrival_year??'Not available'}</strong></div></div>
   <div className="scoutingBlock"><div className="scoutingHeader"><h4>Player evaluation</h4><span>{formatDate(player.scouting_last_reviewed_at)}</span></div><p>{player.scouting_summary??'There is not enough verified information to publish a responsible evaluation yet.'}</p>{player.scouting_grades&&<div className="grades">{Object.entries(player.scouting_grades).map(([tool,grade])=><span key={tool}><b>{tool}</b>{grade}</span>)}</div>}{player.scouting_source_label&&<small>{player.scouting_source_label}</small>}</div>
   <Link className="statsLink" href={`/players/${player.id}`}>Stats & Full Profile →</Link><footer><span>{player.source_name}</span><span>Checked {formatDate(player.source_last_verified_at)}</span></footer>
  </article>})}</section>
 </>;
}
