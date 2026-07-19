import { NextRequest, NextResponse } from 'next/server';
import rankingsData from '../../../../data/rankings.json';
import statsData from '../../../../data/stats.json';
import injuriesData from '../../../../data/injuries.json';
import promotionsData from '../../../../data/promotions.json';
import { projectPlayer } from '../../../../lib/genie/projections';
import type { PlayerEvidence, GenieMetric } from '../../../../lib/genie/types';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Row=Record<string,any>;
const rankings=rankingsData.records as Row[];
const stats=statsData.records as Row[];
const injuries=injuriesData.records as Row[];
const promotions=promotionsData.records as Row[];
const normalize=(value='')=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const clamp=(value:number)=>Math.max(0,Math.min(100,value));

function statFor(player:Row){return stats.find(row=>normalize(row.player)===normalize(player.player));}
function injuryFor(player:Row){return injuries.find(row=>normalize(row.player)===normalize(player.player));}
function promotionsFor(player:Row){return promotions.filter(row=>normalize(row.player)===normalize(player.player));}
function scores(player:Row):Record<GenieMetric,number>{
  const stat=statFor(player),s=stat?.stats||{};
  const scouting=clamp(Number(player.components?.scouting||0)*3.3);
  const performance=s.type==='hitting'?clamp(Number(s.ops||0)*85+Math.max(0,24-Number(s.strikeoutRate||24))+Number(s.walkRate||0)*.7):s.type==='pitching'?clamp(70-Number(s.era||7)*7+Number(s.kPer9||0)*3-Math.max(0,Number(s.bbPer9||3)-3)*6):clamp(Number(player.components?.performance||0)*3.3);
  const readiness=clamp(({MLB:95,AAA:80,AA:60,'A+':42,A:27,Rookie:12} as Record<string,number>)[stat?.level||player.level]||15);
  const momentum=clamp(performance+Number(player.change||0)*8+promotionsFor(player).length*4-(injuryFor(player)?25:0));
  const ceiling=clamp(scouting*.7+performance*.3);
  const floor=clamp(readiness*.45+performance*.35+scouting*.2-(injuryFor(player)?12:0));
  const risk=clamp(100-floor+(injuryFor(player)?25:0));
  return {overall:clamp(Number(player.score||0)),ceiling,floor,performance,momentum,readiness,power:s.type==='hitting'?clamp(Number(s.slg||0)*120+Number(s.homeRuns||0)*1.6):0,speed:s.type==='hitting'?clamp(Number(s.stolenBases||0)*4):0,contact:s.type==='hitting'?clamp(Number(s.average||0)*250+Math.max(0,25-Number(s.strikeoutRate||25))):0,discipline:s.type==='hitting'?clamp(Number(s.walkRate||0)*6+Math.max(0,22-Number(s.strikeoutRate||22))):0,strikeouts:s.type==='pitching'?clamp(Number(s.kPer9||0)*8):0,command:s.type==='pitching'?clamp(100-Number(s.bbPer9||6)*14):0,risk};
}

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`);
}

export async function POST(request:NextRequest){
  if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:'Supabase history storage is not configured.'},{status:503});

  const capturedAt=new Date().toISOString();
  const rows=rankings.map(player=>{
    const stat=statFor(player),injury=injuryFor(player),modelScores=scores(player);
    const evidence:PlayerEvidence={player,stat,injury,promotions:promotionsFor(player),scores:modelScores,strengths:[],concerns:[]};
    const sourceIds=['mlb_stats_api','local_rankings_model'];
    if(injury)sourceIds.push('phillies_official');
    return{
      player_id:String(stat?.playerId||player.playerId||player.player),
      player_name:player.player,
      captured_at:capturedAt,
      season:Number((statsData as any).season||new Date().getUTCFullYear()),
      level:stat?.level||player.level||null,
      affiliate:stat?.affiliate||player.affiliate||null,
      organization_rank:Number(player.rank)||null,
      ranking_score:Number(player.score)||null,
      injury_status:injury?.status||injury?.injury||null,
      stats:stat?.stats||{},
      model_scores:modelScores,
      projections:projectPlayer(evidence),
      source_ids:sourceIds,
      source_evidence:[
        {source_id:'mlb_stats_api',captured_at:(statsData as any).updatedAt,fields:['identity','bio','affiliate','level','statistics']},
        {source_id:'local_rankings_model',captured_at:(rankingsData as any).updatedAt,fields:['organization_rank','ranking_score','model_components']},
        ...(injury?[{source_id:'phillies_official',captured_at:injury.updatedAt||capturedAt,fields:['injury_status']}]:[])
      ],
      source_quality:injury?4.5:4
    };
  });

  const response=await fetch(`${url}/rest/v1/player_snapshots?on_conflict=player_id,snapshot_date`,{
    method:'POST',
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify(rows)
  });
  if(!response.ok)return NextResponse.json({error:'Snapshot write failed',detail:await response.text()},{status:500});
  return NextResponse.json({ok:true,capturedAt,players:rows.length,sources:['MLB Stats API','Prospect Pulse derived rankings','Phillies official injury evidence when present']});
}
