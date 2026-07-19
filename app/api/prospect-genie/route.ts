import { NextRequest, NextResponse } from 'next/server';
import rankingsData from '../../../data/rankings.json';
import { parseIntent } from '../../../lib/genie/parser';
import { runEngine } from '../../../lib/genie/engine';
import { writeAnswer } from '../../../lib/genie/writer';
import { buildMemory, resolveFollowUpPlayers } from '../../../lib/genie/memory';
import { applyHistoricalIntelligence } from '../../../lib/genie/history';
import { analyzeOrganization, isOrganizationQuestion } from '../../../lib/genie/organization';
import { isSimulationQuestion, simulateScenario } from '../../../lib/genie/simulation';

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

    if(isSimulationQuestion(question)){
      const simulation=simulateScenario(question);
      return NextResponse.json({
        answer:simulation.answer,
        matchedPlayers,
        engine:'Prospect Genie simulation and decision lab v7.0',
        intent:{task:'simulate_scenario',metric:'system_impact',filters:{},limit:simulation.actions.length},
        plan:[
          {tool:'cloneOrganizationState',description:'Create an isolated copy of the current tracked prospect system.'},
          {tool:'parseScenarioActions',description:'Identify promotions, graduations, injuries, trades and draft additions.'},
          {tool:'applyScenario',description:'Apply changes without modifying live prospect data.'},
          {tool:'rescoreOrganization',description:'Recalculate system and position-group depth after the scenario.'},
          {tool:'compareOutcomes',description:'Measure winners, risks and before-versus-after changes.'},
          {tool:'recommendResponse',description:'Suggest development or roster responses to the modeled effects.'}
        ],
        confidence:simulation.actions.length?'moderate':'low',
        limitations:simulation.assumptions,
        simulation,
        memory:{activePlayers:memory.activePlayers.slice(0,5)},
        requestQuestion:question
      },{headers:{'Cache-Control':'no-store, max-age=0'}});
    }

    if(isOrganizationQuestion(question)&&!matchedPlayers.length){
      const organization=analyzeOrganization(question);
      return NextResponse.json({
        answer:organization.answer,
        matchedPlayers:[],
        engine:'Prospect Genie simulation and decision lab v7.0',
        intent:{task:'organizational_analysis',metric:'system_depth',filters:{},limit:organization.groups.length},
        plan:[
          {tool:'buildOrganizationMap',description:'Group the tracked system by position and level.'},
          {tool:'scorePositionDepth',description:'Measure quality, quantity, proximity and injury exposure.'},
          {tool:'detectSurplusesAndWeaknesses',description:'Identify strong, thin and overcrowded pipelines.'},
          {tool:'findBlockedPlayers',description:'Flag upper-minors players facing internal depth pressure.'},
          {tool:'recommendOrganizationActions',description:'Produce development, acquisition and trade recommendations.'}
        ],
        confidence:'moderate',
        limitations:['This layer models the tracked prospect pool. Full MLB contracts, options, 40-man status and Rule 5 eligibility are not integrated yet.'],
        organization,
        memory:{activePlayers:memory.activePlayers.slice(0,5)},
        requestQuestion:question
      },{headers:{'Cache-Control':'no-store, max-age=0'}});
    }

    const intent=parseIntent(question,matchedPlayers);
    const currentResult=runEngine(intent);
    const result=await applyHistoricalIntelligence(currentResult);
    const answer=writeAnswer(result);

    return NextResponse.json({
      answer,
      matchedPlayers,
      engine:'Prospect Genie simulation and decision lab v7.0',
      intent:{task:intent.task,metric:intent.metric,filters:intent.filters,limit:intent.limit},
      plan:result.plan.steps,
      confidence:result.confidence,
      limitations:result.limitations,
      evidence:result.evidence.map(item=>({
        player:item.player.player,
        currentScores:item.scores,
        projections:item.projections,
        history:(item as any).history||null
      })),
      memory:{activePlayers:memory.activePlayers.slice(0,5)},
      requestQuestion:question
    },{headers:{'Cache-Control':'no-store, max-age=0'}});
  }catch(error){
    console.error('Prospect Genie route error:',error);
    return NextResponse.json({error:'The Genie hit an unexpected error.'},{status:500});
  }
}
