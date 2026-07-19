import { NextRequest, NextResponse } from 'next/server';
import { enrichRankings } from '../../../lib/ranking/intelligence';
import { parseIntent } from '../../../lib/genie/parser';
import { runEngine } from '../../../lib/genie/engine';
import { writeAnswer } from '../../../lib/genie/writer';
import { buildMemory, resolveFollowUpPlayers } from '../../../lib/genie/memory';
import { applyHistoricalIntelligence } from '../../../lib/genie/history';
import { analyzeOrganization, isOrganizationQuestion } from '../../../lib/genie/organization';
import { isSimulationQuestion, simulateScenario } from '../../../lib/genie/simulation';
import { buildFrontOfficeReport, isFrontOfficeQuestion } from '../../../lib/genie/frontoffice';
import { buildDevelopmentDossier, isDevelopmentQuestion } from '../../../lib/genie/development';
import { normalizeText } from '../../../lib/genie/shared';
import { finalizeGeniePayload } from '../../../lib/genie/reliability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, any>;
const rankings = enrichRankings() as Row[];
const wordSet = (value = '') => new Set(normalizeText(value).split(' ').filter(Boolean));
const respond=(payload:Record<string,any>)=>NextResponse.json(finalizeGeniePayload(payload),{headers:{'Cache-Control':'no-store, max-age=0'}});

function findPlayerNames(question:string){
  const q=normalizeText(question);
  const qWords=wordSet(question);
  return rankings.filter(player=>{
    const full=normalizeText(player.player);
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

    if(isDevelopmentQuestion(question)){
      if(!matchedPlayers.length){
        return respond({answer:'Name a Phillies prospect so I can build a development dossier and compare current evidence with historical snapshots.',matchedPlayers:[],intent:{task:'development_dossier',metric:'development_trajectory',filters:{},limit:1},confidence:'low',limitations:['A player must be identified before development trends can be evaluated.'],memory:{activePlayers:memory.activePlayers.slice(0,5)},requestQuestion:question});
      }
      const development=await buildDevelopmentDossier(matchedPlayers[0]);
      return respond({answer:development.answer,matchedPlayers,intent:{task:'development_dossier',metric:'development_trajectory',filters:{},limit:development.trajectories.length},plan:[{tool:'loadCurrentPlayerState',description:'Load the current ranking, level, statistics, health and promotion records.'},{tool:'loadHistoricalSnapshots',description:'Retrieve comparable player snapshots in chronological order.'},{tool:'separatePerformanceFromDevelopment',description:'Measure changes in underlying skills rather than relying on one current stat line.'},{tool:'classifySkillTrajectories',description:'Mark contact, discipline, power, command, workload and production as improving, declining or stable.'},{tool:'buildLivingDossier',description:'Create a current focus, concern, milestone, confidence score and development narrative.'},{tool:'auditAnswerReliability',description:'Cross-check identities, ranking scores, evidence, bounds and source freshness before returning the answer.'}],confidence:development.developmentConfidence>=70?'high':development.developmentConfidence>=40?'moderate':'low',limitations:development.limitations,development,memory:{activePlayers:memory.activePlayers.slice(0,5)},requestQuestion:question});
    }

    if(isSimulationQuestion(question)){
      const simulation=simulateScenario(question);
      return respond({answer:simulation.answer,matchedPlayers,intent:{task:'simulate_scenario',metric:'system_impact',filters:{},limit:simulation.actions.length},plan:[{tool:'cloneOrganizationState',description:'Create an isolated copy of the current tracked prospect system.'},{tool:'parseScenarioActions',description:'Identify promotions, graduations, injuries, trades and draft additions.'},{tool:'applyScenario',description:'Apply changes without modifying live prospect data.'},{tool:'rescoreOrganization',description:'Recalculate system and position-group depth after the scenario.'},{tool:'compareOutcomes',description:'Measure winners, risks and before-versus-after changes.'},{tool:'recommendResponse',description:'Suggest development or roster responses to the modeled effects.'},{tool:'auditAnswerReliability',description:'Cross-check identities, evidence, bounds and source freshness before returning the answer.'}],confidence:simulation.actions.length?'moderate':'low',limitations:simulation.assumptions,simulation,memory:{activePlayers:memory.activePlayers.slice(0,5)},requestQuestion:question});
    }

    if(isFrontOfficeQuestion(question)){
      const frontOffice=buildFrontOfficeReport(question,matchedPlayers);
      return respond({answer:frontOffice.answer,matchedPlayers,intent:{task:'phillies_development_decision',metric:'promotion_readiness',filters:{},limit:frontOffice.promotionBoard.length},plan:[{tool:'mapAffiliateAssignments',description:'Build the current Phillies affiliate and level map.'},{tool:'measurePlayingTimePressure',description:'Identify same-level positional competition and likely blockers.'},{tool:'scorePromotionReadiness',description:'Combine prospect quality, performance, age-level fit, momentum and health.'},{tool:'explainDecisionDrivers',description:'Separate evidence supporting promotion from reasons to hold.'},{tool:'recommendDevelopmentAction',description:'Return a promote, monitor, hold or rehab recommendation.'},{tool:'auditAnswerReliability',description:'Cross-check identities, evidence, bounds and source freshness before returning the answer.'}],confidence:'moderate',limitations:['Exact plate appearances, innings targets, defensive assignments and private scouting reports are not yet integrated.','Affiliate roster listings are inferred from the currently tracked prospect dataset and may not represent every organizational player.'],frontOffice,memory:{activePlayers:memory.activePlayers.slice(0,5)},requestQuestion:question});
    }

    if(isOrganizationQuestion(question)&&!matchedPlayers.length){
      const organization=analyzeOrganization(question);
      return respond({answer:organization.answer,matchedPlayers:[],intent:{task:'organizational_analysis',metric:'system_depth',filters:{},limit:organization.groups.length},plan:[{tool:'buildOrganizationMap',description:'Group the tracked system by position and level.'},{tool:'scorePositionDepth',description:'Measure quality, quantity, proximity and injury exposure.'},{tool:'detectSurplusesAndWeaknesses',description:'Identify strong, thin and overcrowded pipelines.'},{tool:'findBlockedPlayers',description:'Flag upper-minors players facing internal depth pressure.'},{tool:'recommendOrganizationActions',description:'Produce development, acquisition and trade recommendations.'},{tool:'auditAnswerReliability',description:'Cross-check evidence, score bounds and source freshness before returning the answer.'}],confidence:'moderate',limitations:['This layer models the tracked prospect pool. Full MLB contracts, options, 40-man status and Rule 5 eligibility are not integrated yet.'],organization,memory:{activePlayers:memory.activePlayers.slice(0,5)},requestQuestion:question});
    }

    const intent=parseIntent(question,matchedPlayers);
    const currentResult=runEngine(intent);
    const result=await applyHistoricalIntelligence(currentResult);
    const answer=writeAnswer(result);
    return respond({answer,matchedPlayers,intent:{task:intent.task,metric:intent.metric,filters:intent.filters,limit:intent.limit},plan:[...result.plan.steps,{tool:'auditAnswerReliability',description:'Cross-check player identities, canonical ranking scores, evidence, score bounds and source freshness before returning the answer.'}],confidence:result.confidence,limitations:result.limitations,evidence:result.evidence.map(item=>({player:item.player.player,currentScores:item.scores,projections:item.projections,history:(item as any).history||null})),memory:{activePlayers:memory.activePlayers.slice(0,5)},requestQuestion:question});
  }catch(error){
    console.error('Prospect Genie route error:',error);
    return NextResponse.json({error:'The Genie hit an unexpected error.'},{status:500});
  }
}
