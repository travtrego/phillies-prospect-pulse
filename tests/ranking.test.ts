import test from 'node:test';
import assert from 'node:assert/strict';
import { consensusScore, evaluateRanking, rankCorrelation, RANKING_MODEL_VERSION } from '../lib/ranking/model';
import { enrichRankings, rankRecords, type RankingSourceRecord } from '../lib/ranking/intelligence';

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

test('every published ranking receives intelligence metadata and v4 score',()=>{
  const records=enrichRankings();
  assert.ok(records.length>=20);
  assert.ok(records.every((record,index)=>record.rank===index+1));
  assert.ok(records.every(record=>record.score===record.intelligence.modelScore));
  assert.ok(records.every(record=>record.intelligence.modelVersion===RANKING_MODEL_VERSION));
  assert.ok(records.every(record=>record.intelligence.confidenceScore>=0&&record.intelligence.confidenceScore<=100));
});

test('published board is sorted by the v4 model score',()=>{
  const records=enrichRankings();
  for(let index=1;index<records.length;index++){
    assert.ok(records[index-1].score>=records[index].score);
  }
});

test('changing a model input changes the published score and order',()=>{
  const base=(player:string,playerId:string,scouting:number):RankingSourceRecord=>({
    playerId,player,position:'SS',affiliate:'Reading Fightin Phils',level:'AA',score:50,previousRank:null,rank:1,change:0,mediaMentions:0,reasons:[],components:{scouting,performance:12.5,ageLevel:5,sentiment:10,movement:5,risk:2.5}
  });
  const initial=rankRecords([base('Alpha Prospect','alpha',15),base('Beta Prospect','beta',30)]);
  assert.equal(initial[0].player,'Beta Prospect');
  const alphaInitial=initial.find(record=>record.player==='Alpha Prospect')!;
  const updated=rankRecords([base('Alpha Prospect','alpha',30),base('Beta Prospect','beta',15)]);
  assert.equal(updated[0].player,'Alpha Prospect');
  const alphaUpdated=updated.find(record=>record.player==='Alpha Prospect')!;
  assert.ok(alphaUpdated.score>alphaInitial.score);
});

test('published v4 scores are not merely legacy metadata',()=>{
  const records=enrichRankings();
  assert.ok(records.some(record=>record.score!==record.legacyScore||record.rank!==record.legacyRank));
});
