import { NextRequest, NextResponse } from 'next/server';
import rankingsData from '../../../data/rankings.json';
import { parseIntent } from '../../../lib/genie/parser';
import { runEngine } from '../../../lib/genie/engine';
import { writeAnswer } from '../../../lib/genie/writer';
import { buildMemory, resolveFollowUpPlayers } from '../../../lib/genie/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, any>;
const rankings = rankingsData.records as Row[];
const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const wordSet = (value = '') => new Set(normalize(value).split(' ').filter(Boolean));

function findPlayerNames(question:string){
  const q=normalize(question);
  const qWords=wordSet(question);
  return rankings.filter(player=>{
    const full=normalize(player.player);
    const last=full.split(' ').at(-1)||'';
    return q.includes(full)||(last.length>=4&&qWords.has(last));
  }).map(player=>player.player);
}

export async function POST(request:NextRequest){
  try{
    const body=await request.json();
    const question=typeof body.question==='string'?body.question.trim():'';
    const history=Array.isArray(body.history)?body.history.slice(-20):[];
    if(!question)return NextResponse.json({error:'Ask the Genie a question.'},{status:400});
    if(question.length>1000)return NextResponse.json({error:'Please keep the question under 1,000 characters.'},{status:400});

    const memory=buildMemory(history,findPlayerNames);
    let matchedPlayers=findPlayerNames(question);
    if(!matchedPlayers.length)matchedPlayers=resolveFollowUpPlayers(question,memory);

    const intent=parseIntent(question,matchedPlayers);
    const result=runEngine(intent);
    const answer=writeAnswer(result);

    return NextResponse.json({
      answer,
      matchedPlayers,
      engine:'Prospect Genie structured agent v4.1',
      intent:{task:intent.task,metric:intent.metric,filters:intent.filters,limit:intent.limit},
      plan:result.plan.steps,
      confidence:result.confidence,
      limitations:result.limitations,
      memory:{activePlayers:memory.activePlayers.slice(0,5)},
      requestQuestion:question
    },{headers:{'Cache-Control':'no-store, max-age=0'}});
  }catch(error){
    console.error('Prospect Genie route error:',error);
    return NextResponse.json({error:'The Genie hit an unexpected error.'},{status:500});
  }
}
