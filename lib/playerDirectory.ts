import rankingsData from '../data/rankings.json';
import statsData from '../data/stats.json';
import { buildPlayerEvaluation, normalizeName, type StatRecord } from './playerProfile';
import { enrichRankings } from './ranking/intelligence';

export type DirectoryPlayer={
  id:string;full_name:string;primary_position:string|null;current_level:string|null;current_team_name:string|null;mlb_pipeline_rank:number|null;estimated_arrival_year:number|null;bats:string|null;throws:string|null;source_name:string;source_last_verified_at:string|null;scouting_summary:string|null;scouting_grades:Record<string,number>|null;scouting_source_url:string|null;scouting_last_reviewed_at:string|null;
  mlb_id?:number|null;current_age?:number|null;birth_date?:string|null;birth_city?:string|null;birth_state_province?:string|null;birth_country?:string|null;height?:string|null;weight?:number|null;draft_year?:number|null;mlb_debut_date?:string|null;scouting_strengths?:string[];scouting_concerns?:string[];scouting_source_label?:string|null;
};

type RankingRecord={playerId:string;player:string;position?:string|null;affiliate?:string|null;level?:string|null;rank:number;eta?:number|null};
const rankings=enrichRankings() as RankingRecord[];
const stats=statsData.records as StatRecord[];
const statByName=new Map(stats.map(record=>[normalizeName(record.player),record]));

function localPlayer(record:RankingRecord):DirectoryPlayer{
  const stat=statByName.get(normalizeName(record.player));
  const evaluation=buildPlayerEvaluation(stat);
  return{
    id:String(record.playerId),full_name:record.player,primary_position:stat?.position||record.position||null,current_level:stat?.level||record.level||null,current_team_name:stat?.affiliate||record.affiliate||null,mlb_pipeline_rank:record.rank,estimated_arrival_year:record.eta??null,bats:stat?.bats||null,throws:stat?.throws||null,source_name:'Prospect Pulse ranking model v4',source_last_verified_at:statsData.updatedAt||rankingsData.updatedAt,scouting_summary:evaluation.summary,scouting_grades:null,scouting_source_url:null,scouting_last_reviewed_at:statsData.updatedAt,
    mlb_id:stat?.playerId??null,current_age:stat?.currentAge??null,birth_date:stat?.birthDate??null,birth_city:stat?.birthCity??null,birth_state_province:stat?.birthStateProvince??null,birth_country:stat?.birthCountry??null,height:stat?.height??null,weight:stat?.weight??null,draft_year:stat?.draftYear??null,mlb_debut_date:stat?.mlbDebutDate??null,scouting_strengths:evaluation.strengths,scouting_concerns:evaluation.concerns,scouting_source_label:evaluation.sourceLabel
  };
}

const localPlayers=rankings.map(localPlayer);
const canonicalRankByName=new Map(rankings.map(record=>[normalizeName(record.player),record.rank]));

function enrich(player:DirectoryPlayer):DirectoryPlayer{
  const stat=statByName.get(normalizeName(player.full_name));
  const evaluation=buildPlayerEvaluation(stat);
  const canonicalRank=canonicalRankByName.get(normalizeName(player.full_name));
  return{...player,mlb_pipeline_rank:canonicalRank??player.mlb_pipeline_rank,mlb_id:stat?.playerId??player.mlb_id??null,primary_position:stat?.position||player.primary_position,current_level:stat?.level||player.current_level,current_team_name:stat?.affiliate||player.current_team_name,bats:stat?.bats||player.bats||null,throws:stat?.throws||player.throws||null,current_age:stat?.currentAge??player.current_age??null,birth_date:stat?.birthDate??player.birth_date??null,birth_city:stat?.birthCity??player.birth_city??null,birth_state_province:stat?.birthStateProvince??player.birth_state_province??null,birth_country:stat?.birthCountry??player.birth_country??null,height:stat?.height??player.height??null,weight:stat?.weight??player.weight??null,draft_year:stat?.draftYear??player.draft_year??null,mlb_debut_date:stat?.mlbDebutDate??player.mlb_debut_date??null,source_last_verified_at:statsData.updatedAt||player.source_last_verified_at,scouting_summary:player.scouting_summary||evaluation.summary,scouting_strengths:evaluation.strengths,scouting_concerns:evaluation.concerns,scouting_source_label:player.scouting_summary?'Public scouting report':evaluation.sourceLabel,scouting_last_reviewed_at:player.scouting_last_reviewed_at||statsData.updatedAt};
}

async function fetchSupabasePlayers():Promise<DirectoryPlayer[]>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return[];
  try{
    const response=await fetch(`${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&current_level=in.(AAA,AA,A%2B,A)&order=full_name.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:300}});
    if(!response.ok)return[];
    return (await response.json() as DirectoryPlayer[]).map(enrich);
  }catch{return[];}
}

export async function getDirectoryPlayers(){
  const remote=await fetchSupabasePlayers();
  if(!remote.length)return localPlayers;
  const remoteNames=new Set(remote.map(player=>normalizeName(player.full_name)));
  return [...remote,...localPlayers.filter(player=>!remoteNames.has(normalizeName(player.full_name)))].sort((a,b)=>(a.mlb_pipeline_rank??999)-(b.mlb_pipeline_rank??999)||a.full_name.localeCompare(b.full_name));
}

export async function getDirectoryPlayer(id:string){
  const players=await getDirectoryPlayers();
  const direct=players.find(player=>String(player.id)===String(id)||String(player.mlb_id??'')===String(id));
  if(direct)return direct;
  const ranking=rankings.find(record=>String(record.playerId)===String(id));
  return ranking?localPlayer(ranking):null;
}
