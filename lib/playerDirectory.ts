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
const LEVEL_ALIASES:Record<string,string>={ROK:'Rookie',R:'Rookie',DSL:'Rookie'};
const normalizeLevel=(level:string|null|undefined)=>level?LEVEL_ALIASES[level]??level:null;

function localPlayer(record:RankingRecord):DirectoryPlayer{
  const stat=statByName.get(normalizeName(record.player));
  const evaluation=buildPlayerEvaluation(stat);
  return{
    id:String(record.playerId),full_name:record.player,primary_position:stat?.position||record.position||null,current_level:normalizeLevel(stat?.level||record.level),current_team_name:stat?.affiliate||record.affiliate||null,mlb_pipeline_rank:record.rank,estimated_arrival_year:record.eta??null,bats:stat?.bats||null,throws:stat?.throws||null,source_name:'Prospect Pulse ranking model v4',source_last_verified_at:statsData.updatedAt||rankingsData.updatedAt,scouting_summary:evaluation.summary,scouting_grades:null,scouting_source_url:null,scouting_last_reviewed_at:statsData.updatedAt,
    mlb_id:stat?.playerId??null,current_age:stat?.currentAge??null,birth_date:stat?.birthDate??null,birth_city:stat?.birthCity??null,birth_state_province:stat?.birthStateProvince??null,birth_country:stat?.birthCountry??null,height:stat?.height??null,weight:stat?.weight??null,draft_year:stat?.draftYear??null,mlb_debut_date:stat?.mlbDebutDate??null,scouting_strengths:evaluation.strengths,scouting_concerns:evaluation.concerns,scouting_source_label:evaluation.sourceLabel
  };
}

const localPlayers=rankings.map(localPlayer);
const localNamesSet=new Set(localPlayers.map(player=>normalizeName(player.full_name)));

// Supabase holds a hand-curated but infrequently refreshed player_master snapshot, keyed by
// its own UUID rather than the MLB player ID used by the rankings/stats/injuries pipeline that
// GitHub Actions refreshes every few hours. Treat it purely as an optional source of extra
// scouting depth (summary/grades/source link) layered onto the canonical local player, keyed by
// name, so ranks, IDs and levels always stay consistent with the rest of the site.
type SupabaseRow={id:string;full_name:string;primary_position:string|null;current_level:string|null;current_team_name:string|null;mlb_pipeline_rank:number|null;estimated_arrival_year:number|null;bats:string|null;throws:string|null;source_name:string;source_last_verified_at:string|null;scouting_summary:string|null;scouting_grades:Record<string,number>|null;scouting_source_url:string|null;scouting_last_reviewed_at:string|null};

async function fetchSupabaseRows():Promise<SupabaseRow[]>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return[];
  try{
    const response=await fetch(`${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&order=full_name.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:300}});
    if(!response.ok)return[];
    return await response.json() as SupabaseRow[];
  }catch{return[];}
}

function withScoutingDepth(player:DirectoryPlayer,row:SupabaseRow|undefined):DirectoryPlayer{
  if(!row||!row.scouting_summary)return player;
  return{...player,scouting_summary:row.scouting_summary,scouting_grades:row.scouting_grades??player.scouting_grades,scouting_source_url:row.scouting_source_url??player.scouting_source_url,scouting_last_reviewed_at:row.scouting_last_reviewed_at??player.scouting_last_reviewed_at,scouting_source_label:'Public scouting report'};
}

function supabaseExtra(row:SupabaseRow):DirectoryPlayer{
  const stat=statByName.get(normalizeName(row.full_name));
  const evaluation=buildPlayerEvaluation(stat);
  return{
    id:row.id,full_name:row.full_name,primary_position:stat?.position||row.primary_position,current_level:normalizeLevel(stat?.level||row.current_level),current_team_name:stat?.affiliate||row.current_team_name,mlb_pipeline_rank:row.mlb_pipeline_rank,estimated_arrival_year:row.estimated_arrival_year,bats:stat?.bats||row.bats,throws:stat?.throws||row.throws,source_name:row.source_name,source_last_verified_at:row.source_last_verified_at,scouting_summary:row.scouting_summary||evaluation.summary,scouting_grades:row.scouting_grades,scouting_source_url:row.scouting_source_url,scouting_last_reviewed_at:row.scouting_last_reviewed_at,
    mlb_id:stat?.playerId??null,current_age:stat?.currentAge??null,birth_date:stat?.birthDate??null,birth_city:stat?.birthCity??null,birth_state_province:stat?.birthStateProvince??null,birth_country:stat?.birthCountry??null,height:stat?.height??null,weight:stat?.weight??null,draft_year:stat?.draftYear??null,mlb_debut_date:stat?.mlbDebutDate??null,scouting_strengths:evaluation.strengths,scouting_concerns:evaluation.concerns,scouting_source_label:row.scouting_summary?'Public scouting report':evaluation.sourceLabel
  };
}

export async function getDirectoryPlayers(){
  const remote=await fetchSupabaseRows();
  const remoteByName=new Map(remote.map(row=>[normalizeName(row.full_name),row]));
  const merged=localPlayers.map(player=>withScoutingDepth(player,remoteByName.get(normalizeName(player.full_name))));
  const extras=remote.filter(row=>!localNamesSet.has(normalizeName(row.full_name))).map(supabaseExtra);
  return [...merged,...extras].sort((a,b)=>(a.mlb_pipeline_rank??999)-(b.mlb_pipeline_rank??999)||a.full_name.localeCompare(b.full_name));
}

export async function getDirectoryPlayer(id:string){
  const players=await getDirectoryPlayers();
  const direct=players.find(player=>String(player.id)===String(id)||String(player.mlb_id??'')===String(id));
  if(direct)return direct;
  const ranking=rankings.find(record=>String(record.playerId)===String(id));
  return ranking?localPlayer(ranking):null;
}
