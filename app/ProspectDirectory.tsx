'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DirectoryPlayer } from '../lib/playerDirectory';

export type Player = DirectoryPlayer;
export type HomepageRanking={playerId:string;player:string;rank:number;confidence?:'high'|'moderate'|'low'};
const filters=[['top30','Top 30'],['all','All Players'],['AAA','AAA'],['AA','AA'],['A+','High-A'],['A','Single-A'],['Rookie','Rookie'],['pitchers','Pitchers'],['hitters','Position Players']] as const;
const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function initials(name:string){return name.split(' ').filter(Boolean).slice(0,2).map(part=>part[0]).join('')||'PP'}
function formatDate(value:string|null){if(!value)return'Pending';const date=new Date(value);if(Number.isNaN(date.getTime()))return'Pending';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date)}
function isPitcher(position:string|null){return['P','RHP','LHP','SP','RP'].includes((position??'').toUpperCase())}
const LEVEL_CLASS:Record<string,string>={MLB:'lvl-mlb',AAA:'lvl-aaa',AA:'lvl-aa','A+':'lvl-aplus',A:'lvl-a',Rookie:'lvl-rookie'};
function levelClass(level:string|null|undefined){return`level ${LEVEL_CLASS[level??'']??''}`.trim()}
function PlayerAvatar({mlbId,name}:{mlbId?:number|null;name:string}){
 const[failed,setFailed]=useState(false);
 if(mlbId&&!failed)return <img className="avatarImg" src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${mlbId}/headshot/milb/current`} alt="" loading="lazy" onError={()=>setFailed(true)}/>;
 return <>{initials(name)}</>;
}

export default function ProspectDirectory({players,rankings}:{players:Player[];rankings:HomepageRanking[]}){
 const[filter,setFilter]=useState('top30');
 const[search,setSearch]=useState('');
 const[sort,setSort]=useState<'rank'|'name'|'age'|'level'>('rank');
 const rankById=useMemo(()=>new Map(rankings.map(item=>[String(item.playerId),item.rank])),[rankings]);
 const rankByName=useMemo(()=>new Map(rankings.map(item=>[normalize(item.player),item.rank])),[rankings]);
 const getRank=(player:Player)=>rankById.get(String(player.id))??rankByName.get(normalize(player.full_name))??player.mlb_pipeline_rank??null;
 const confidenceById=useMemo(()=>new Map(rankings.map(item=>[String(item.playerId),item.confidence])),[rankings]);
 const confidenceByName=useMemo(()=>new Map(rankings.map(item=>[normalize(item.player),item.confidence])),[rankings]);
 const getConfidence=(player:Player)=>confidenceById.get(String(player.id))??confidenceByName.get(normalize(player.full_name))??null;
 const top30Players=useMemo(()=>players.filter(player=>{const rank=getRank(player);return rank!==null&&rank<=30}),[players,rankById,rankByName]);
 const visiblePlayers=useMemo(()=>{const pool=filter==='top30'?top30Players:players;const query=normalize(search);return pool.filter(player=>{const matchesSearch=!query||normalize(`${player.full_name} ${player.primary_position??''} ${player.current_team_name??''} ${player.current_level??''}`).includes(query);if(!matchesSearch)return false;if(filter==='top30'||filter==='all')return true;if(filter==='pitchers')return isPitcher(player.primary_position);if(filter==='hitters')return!isPitcher(player.primary_position);return player.current_level===filter}).sort((a,b)=>sort==='name'?a.full_name.localeCompare(b.full_name):sort==='age'?(a.current_age??99)-(b.current_age??99):sort==='level'?(b.current_level??'').localeCompare(a.current_level??''):(getRank(a)??999)-(getRank(b)??999))},[players,top30Players,filter,search,sort]);
 return <>
  <section className="directoryToolbar"><div className="toolbarStack"><div className="filterTabs" role="tablist" aria-label="Filter prospects">{filters.map(([value,label])=><button type="button" role="tab" aria-selected={filter===value} key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}</div><span className="filterCount">{visiblePlayers.length} results</span></div><div className="advancedFilters"><select aria-label="Sort players" value={sort} onChange={event=>setSort(event.target.value as typeof sort)}><option value="rank">Sort: Rank</option><option value="name">Sort: Name</option><option value="age">Sort: Age</option><option value="level">Sort: Level</option></select><input aria-label="Search players" placeholder="Search player, team or position…" value={search} onChange={event=>setSearch(event.target.value)}/></div></section>
  <div className="resultsHeader"><div><span className="eyebrow">Player directory</span><h2>{filters.find(([value])=>value===filter)?.[1]}</h2></div><span className="status">Live assignments</span></div>
  <section className="cardGrid" aria-live="polite">{visiblePlayers.map(player=>{const displayRank=getRank(player);const confidence=getConfidence(player);const bio=[player.current_age?`Age ${player.current_age}`:null,player.height,player.weight?`${player.weight} lb`:null].filter(Boolean).join(' · ');return <article className="playerCard" key={player.id}>
   <div className="cardTop"><span className="rank">{displayRank?`#${displayRank}`:'Unranked'}</span><span className={levelClass(player.current_level)}>{player.current_level??'Level unavailable'}</span></div>
   <div className="playerIdentity"><div className="avatar" aria-hidden="true"><PlayerAvatar mlbId={player.mlb_id} name={player.full_name}/></div><div><h3>{player.full_name}</h3><p>{player.primary_position??'Position unavailable'}{bio?` · ${bio}`:''}</p></div></div>
   <div className="cardSignalRow"><span className="signalPill positive">Current roster</span>{player.estimated_arrival_year&&<span className="signalPill">ETA {player.estimated_arrival_year}</span>}{player.scouting_grades&&<span className="signalPill">Grades available</span>}{confidence==='low'&&<span className="signalPill warning" title="This rank leans on limited scouting or performance data">Low-confidence rank</span>}</div>
   <div className="cardDetails"><div><span>Affiliate</span><strong>{player.current_team_name??'Not available'}</strong></div><div><span>Bats / Throws</span><strong>{player.bats??'—'} / {player.throws??'—'}</strong></div><div><span>Draft year</span><strong>{player.draft_year??'Not available'}</strong></div><div><span>Last verified</span><strong>{formatDate(player.source_last_verified_at)}</strong></div></div>
   <div className="scoutingBlock"><div className="scoutingHeader"><h4>Player evaluation</h4><span>{formatDate(player.scouting_last_reviewed_at)}</span></div><p>{player.scouting_summary??'There is not enough verified information to publish a responsible evaluation yet.'}</p>{player.scouting_grades&&<div className="grades">{Object.entries(player.scouting_grades).slice(0,5).map(([tool,grade])=><span key={tool}><b>{tool}</b>{grade}</span>)}</div>}</div>
   <Link className="statsLink" href={`/players/${player.id}`} aria-label={`Open stats and full profile for ${player.full_name}`}>Open full profile →</Link><footer className="cardFooter"><span>{player.source_name}</span><span>{player.current_team_name??'Phillies organization'}</span></footer>
  </article>})}{visiblePlayers.length===0&&<div className="emptyState"><strong>No players match this filter.</strong><p>Try another level or clear the search field.</p></div>}</section>
 </>;
}
