import type { RankingConfidence } from './model';

// Rank-stability confidence.
//
// Each model input carries measurement noise, and that noise depends on how much evidence
// sits behind it: a .900 OPS over 60 plate appearances is far less certain than over 450.
// We give every input a standard deviation (on its 0-100 scale), propagate it through the
// model's linear weights to a per-player score standard deviation, then re-rank the whole
// board many times with that noise added. Confidence is the share of simulated boards in
// which the player lands within RANK_WINDOW spots of his published rank. Players bunched
// in score with neighbours, or ranked on thin samples, come out less certain.

export const SIMULATIONS=1000;
export const RANK_WINDOW=3;

export type StabilityInput={
  score:number;
  weights:Record<string,number>;
  plateAppearances?:number|null;
  inningsPitched?:number|null;
  mediaMentions?:number|null;
};

export type StabilityResult={confidence:RankingConfidence;confidenceScore:number;scoreStdDev:number;rankLow:number;rankHigh:number};

// Baseline noise per input on the 0-100 scale. Inputs that are facts (level, age,
// promotions, IL status) are nearly noise-free; evaluative inputs are not.
const BASE_SD:Record<string,number>={scouting:10,performance:25,ageLevel:3,sentiment:15,movement:3,risk:3,development:6,defense:8,pitchQuality:8,history:8,consensus:8};
// Sample size at which performance noise is cut by ~30% (sd = base / sqrt(1 + n / n0)).
const PA_HALF=60;
const IP_HALF=15;

function inningsToNumber(value:unknown){
  const text=String(value??'');
  const [whole,outs]=text.split('.');
  const innings=Number(whole)+(Number(outs)||0)/3;
  return Number.isFinite(innings)?innings:0;
}

export function inputStdDevs(input:StabilityInput):Record<string,number>{
  const sds={...BASE_SD};
  const pa=Number(input.plateAppearances)||0;
  const ip=inningsToNumber(input.inningsPitched);
  sds.performance=pa>0?BASE_SD.performance/Math.sqrt(1+pa/PA_HALF):ip>0?BASE_SD.performance/Math.sqrt(1+ip/IP_HALF):BASE_SD.performance;
  sds.sentiment=BASE_SD.sentiment/Math.sqrt(1+Math.max(0,Number(input.mediaMentions)||0));
  return sds;
}

export function scoreStdDev(input:StabilityInput){
  const sds=inputStdDevs(input);
  const variance=Object.entries(input.weights).reduce((sum,[key,weight])=>sum+(weight*(sds[key]??0))**2,0);
  return Math.sqrt(variance);
}

// Deterministic PRNG so the published board is reproducible build to build.
function mulberry32(seed:number){
  return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
function gaussian(random:()=>number){
  let u=0;while(u===0)u=random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*random());
}

export function confidenceLabel(score:number):RankingConfidence{return score>=75?'high':score>=50?'moderate':'low';}

// inputs must be in published rank order (index 0 = #1).
export function rankStability(inputs:StabilityInput[],simulations=SIMULATIONS,seed=20260710):StabilityResult[]{
  const n=inputs.length;
  const sds=inputs.map(scoreStdDev);
  const hits=new Array(n).fill(0);
  const ranks=inputs.map(()=>[] as number[]);
  const random=mulberry32(seed);
  const order=inputs.map((_,index)=>index);
  const noisy=new Array(n).fill(0);
  for(let sim=0;sim<simulations;sim++){
    for(let i=0;i<n;i++)noisy[i]=inputs[i].score+sds[i]*gaussian(random);
    order.sort((a,b)=>noisy[b]-noisy[a]);
    order.forEach((player,position)=>{
      ranks[player].push(position+1);
      if(Math.abs(position-player)<=RANK_WINDOW)hits[player]++;
    });
  }
  return inputs.map((_,i)=>{
    const sorted=ranks[i].sort((a,b)=>a-b);
    const pick=(q:number)=>sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))]??i+1;
    const confidenceScore=Math.round(hits[i]/Math.max(simulations,1)*100);
    return{confidence:confidenceLabel(confidenceScore),confidenceScore,scoreStdDev:Number(sds[i].toFixed(2)),rankLow:pick(0.1),rankHigh:pick(0.9)};
  });
}
