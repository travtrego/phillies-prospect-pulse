import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from '../lib/genie/parser';
import { decisionMetric, projectPlayer } from '../lib/genie/projections';
import { buildDevelopmentDossier, isDevelopmentQuestion } from '../lib/genie/development';
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
