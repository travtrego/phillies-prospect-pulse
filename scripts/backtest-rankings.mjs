import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const rankings=read('data/rankings.json').records||[];
const external=read('data/external-rankings.json').records||[];
const normalize=(value='')=>String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const spearman=(a,b)=>{if(a.length!==b.length||a.length<2)return null;const n=a.length;const sum=a.reduce((total,value,index)=>total+(value-b[index])**2,0);return 1-(6*sum)/(n*(n*n-1));};
const mae=(a,b)=>a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]),0)/a.length;

const previous=rankings.filter(row=>Number.isFinite(Number(row.previousRank)));
const currentRanks=previous.map(row=>Number(row.rank));
const priorRanks=previous.map(row=>Number(row.previousRank));
const rankStability=previous.length>=2?spearman(currentRanks,priorRanks):null;
const movementMae=previous.length?mae(currentRanks,priorRanks):null;

const externalByPlayer=new Map();
for(const row of external){const key=normalize(row.player);externalByPlayer.set(key,[...(externalByPlayer.get(key)||[]),Number(row.rank)].filter(Number.isFinite));}
const validation=rankings.map(row=>{const ranks=externalByPlayer.get(normalize(row.player))||[];if(!ranks.length)return null;const mean=ranks.reduce((sum,value)=>sum+value,0)/ranks.length;return{pulse:Number(row.rank),external:mean};}).filter(Boolean);
const externalCorrelation=validation.length>=2?spearman(validation.map(row=>row.pulse),validation.map(row=>row.external)):null;
const externalMae=validation.length?mae(validation.map(row=>row.pulse),validation.map(row=>row.external)):null;

const report={
  generatedAt:new Date().toISOString(),
  modelVersion:'4.0.0',
  records:rankings.length,
  priorSnapshotComparison:{sampleSize:previous.length,spearman:rankStability===null?null:Number(rankStability.toFixed(3)),meanAbsoluteRankChange:movementMae===null?null:Number(movementMae.toFixed(2))},
  externalValidation:{sampleSize:validation.length,spearman:externalCorrelation===null?null:Number(externalCorrelation.toFixed(3)),meanAbsoluteRankDifference:externalMae===null?null:Number(externalMae.toFixed(2))},
  interpretation:{
    priorSnapshot:'Measures ranking stability, not predictive accuracy. True outcome backtesting requires archived rankings paired with later MLB outcomes.',
    external:'Measures agreement with optional public ranking observations. An empty source file is reported honestly as no validation sample.'
  }
};
fs.mkdirSync(path.join(root,'data','reports'),{recursive:true});
fs.writeFileSync(path.join(root,'data','reports','ranking-backtest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(rankings.length<20){console.error('FAIL: insufficient ranking records for a meaningful model run');process.exit(1);}
console.log('PASS: ranking backtest harness completed.');
