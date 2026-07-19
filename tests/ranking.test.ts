import test from 'node:test';
import assert from 'node:assert/strict';
import { consensusScore, evaluateRanking, rankCorrelation, RANKING_MODEL_VERSION } from '../lib/ranking/model';
import { enrichRankings } from '../lib/ranking/intelligence';

test('ranking model has a version',()=>{
  assert.match(RANKING_MODEL_VERSION,/^\d+\.\d+\.\d+$/);
});

test('ranking evaluation remains bounded and explainable',()=>{
  const result=evaluateRanking({scouting:80,performance:70,ageLevel:65,sentiment:55,movement:60,risk:75,development:72,defense:68,pitchQuality:74,history:60,consensus:82});
  assert.ok(result.score>=0&&result.score<=100);
  assert.ok(result.breakdown.length>=10);
  assert.ok(result.breakdown.every(item=>item.contribution>=0));
  assert.equal(result.confidence,'high');
});

test('missing optional inputs lower confidence but do not break scoring',()=>{
  const result=evaluateRanking({scouting:80,performance:70,ageLevel:65,sentiment:55,movement:60,risk:75});
  assert.ok(result.score>=0&&result.score<=100);
  assert.notEqual(result.confidence,'high');
  assert.ok(result.limitations.length>=3);
});

test('consensus validation measures agreement',()=>{
  const result=consensusScore(5,[4,5,6],30);
  assert.ok(result);
  assert.equal(result?.meanRank,5);
  assert.equal(result?.difference,0);
  assert.equal(result?.agreement,100);
});

test('rank correlation identifies exact agreement',()=>{
  assert.equal(rankCorrelation([1,2,3,4],[1,2,3,4]),1);
});

test('every published ranking receives intelligence metadata',()=>{
  const records=enrichRankings();
  assert.ok(records.length>=20);
  assert.ok(records.every(record=>record.intelligence.modelVersion===RANKING_MODEL_VERSION));
  assert.ok(records.every(record=>record.intelligence.confidenceScore>=0&&record.intelligence.confidenceScore<=100));
});
