import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from '../lib/genie/parser';
import { decisionMetric, projectPlayer } from '../lib/genie/projections';
import { buildDevelopmentDossier, isDevelopmentQuestion } from '../lib/genie/development';
import { buildPredictiveFrontOfficeReport, isPredictiveFrontOfficeQuestion, GENIE_PREDICTIVE_FRONT_OFFICE_VERSION } from '../lib/genie/predictiveFrontOffice';
import { auditGeniePayload, finalizeGeniePayload, GENIE_INTERNAL_AUDIT_VERSION } from '../lib/genie/reliability';
import { enrichRankings } from '../lib/ranking/intelligence';
import type { PlayerEvidence } from '../lib/genie/types';

const scores={overall:70,ceiling:75,floor:60,performance:72,momentum:74,readiness:68,power:65,speed:40,contact:62,discipline:58,strikeouts:0,command:0,risk:42};
const evidence:PlayerEvidence={player:{player:'Test Prospect',age:21,level:'AA'},stat:{player:'Test Prospect',currentAge:21,level:'AA'},promotions:[],scores,strengths:['performance'],concerns:[]};

test('calendar years do not become result limits',()=>{
  const intent=parseIntent('Show me the Phillies farm system in 2028',[]);
  assert.equal(intent.limit,5);
});

test('explicit top limits are respected and capped',()=>{
  assert.equal(parseIntent('Show me the top 3 pitchers',[]).limit,3);
  assert.equal(parseIntent('Show me the top 99 pitchers',[]).limit,10);
});

test('risk questions select the risk metric',()=>{
  assert.equal(parseIntent('Which prospects carry the most risk?',[]).metric,'risk');
});

test('promotion and trade questions route to the correct decision metric',()=>{
  assert.equal(decisionMetric('Should Test Prospect be promoted?'),'promotionProbability');
  assert.equal(decisionMetric('What is his trade value?'),'tradeValue');
});

test('projection scores remain bounded and include explanations',()=>{
  const result=projectPlayer(evidence);
  for(const value of [result.mlbProbability,result.promotionProbability,result.breakoutProbability,result.tradeValue,result.protectScore,result.volatility]){
    assert.ok(value>=0&&value<=100);
  }
  assert.ok(result.drivers.length>=4);
  assert.ok(result.drivers.every(driver=>driver.explanation.length>0));
});

test('injuries lower near-term projection outcomes',()=>{
  const healthy=projectPlayer(evidence);
  const injured=projectPlayer({...evidence,injury:{player:'Test Prospect',status:'Injured'}});
  assert.ok(injured.mlbProbability<healthy.mlbProbability);
  assert.ok(injured.promotionProbability<healthy.promotionProbability);
});

test('development questions route to Genie 9.0',()=>{
  assert.equal(isDevelopmentQuestion('Is Aidan Miller actually getting better?'),true);
  assert.equal(isDevelopmentQuestion('Show me his living scouting dossier'),true);
  assert.equal(isDevelopmentQuestion('What is his trade value?'),false);
});

test('development dossier degrades safely without Supabase history',async()=>{
  const dossier=await buildDevelopmentDossier('Aidan Miller');
  assert.equal(dossier.player,'Aidan Miller');
  assert.ok(dossier.developmentScore>=0&&dossier.developmentScore<=100);
  assert.ok(dossier.developmentConfidence>=0&&dossier.developmentConfidence<=100);
  assert.ok(dossier.answer.includes('development dossier'));
  assert.ok(dossier.limitations.length>0);
});

test('predictive front office questions route to Genie 10.0',()=>{
  assert.equal(isPredictiveFrontOfficeQuestion('Project the Phillies 26-man roster for the next three seasons'),true);
  assert.equal(isPredictiveFrontOfficeQuestion('Who needs 40-man protection from the Rule 5 draft?'),true);
  assert.equal(isPredictiveFrontOfficeQuestion('Simulate a trade package built around Aidan Miller'),true);
  assert.equal(isPredictiveFrontOfficeQuestion('Is Aidan Miller getting better?'),false);
  assert.equal(GENIE_PREDICTIVE_FRONT_OFFICE_VERSION,'10.0.0');
});

test('Genie 10 produces three future roster scenarios and protection decisions',async()=>{
  const report=await buildPredictiveFrontOfficeReport('Project the Phillies 26-man roster and Rule 5 decisions for the next three seasons',[]);
  assert.equal(report.version,'10.0.0');
  assert.equal(report.futureRosters.length,3);
  assert.ok(report.futureRosters.every(roster=>roster.players.length<=26));
  assert.ok(report.futureRosters.every(roster=>roster.season>new Date().getUTCFullYear()));
  assert.ok(report.fortyMan.decisions.length>0);
  assert.ok(report.rule5.decisions.every(item=>item.protectionScore>=0&&item.protectionScore<=100));
  assert.ok(report.answer.includes('Predictive Front Office v10.0'));
});

test('Genie 10 creates bounded trade-package simulations',async()=>{
  const report=await buildPredictiveFrontOfficeReport('Simulate an impact trade package around Aidan Miller',['Aidan Miller']);
  assert.ok(report.tradePackage);
  assert.ok((report.tradePackage?.packageValue??-1)>=0&&(report.tradePackage?.packageValue??101)<=100);
  assert.equal(report.tradePackage?.targetTier,'impact');
  assert.ok(report.tradePackage?.players.includes('Aidan Miller'));
});

test('internal reliability guardrail is not presented as Genie layer 10',()=>{
  const top=enrichRankings()[0];
  const payload={answer:`${top.player} is the current top-ranked prospect.`,matchedPlayers:[top.player],intent:{task:'player_profile'},confidence:'high',limitations:[],evidence:[{player:top.player,currentScores:{overall:top.score}}]};
  const audit=auditGeniePayload(payload);
  assert.equal(audit.version,GENIE_INTERNAL_AUDIT_VERSION);
  assert.equal('layer' in audit,false);
  assert.equal(audit.passed,true);
  const finalized=finalizeGeniePayload({engine:'Prospect Genie Predictive Front Office v10.0',...payload});
  assert.equal(finalized.engine,'Prospect Genie Predictive Front Office v10.0');
});

test('reliability guardrail catches canonical score disagreements',()=>{
  const top=enrichRankings()[0];
  const audit=auditGeniePayload({answer:'This answer is long enough to be audited correctly.',matchedPlayers:[top.player],intent:{task:'player_profile'},limitations:[],evidence:[{player:top.player,currentScores:{overall:top.score-10}}]});
  assert.equal(audit.passed,false);
  assert.ok(audit.checks.some(check=>check.id==='canonical-ranking-consistency'&&!check.passed));
});
