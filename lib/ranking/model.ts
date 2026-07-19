export const RANKING_MODEL_VERSION='4.0.0';

export type RankingInputs={
  scouting:number;
  performance:number;
  ageLevel:number;
  sentiment:number;
  movement:number;
  risk:number;
  development?:number;
  defense?:number;
  pitchQuality?:number;
  history?:number;
  consensus?:number;
};

export type RankingConfidence='high'|'moderate'|'low';
export type RankingBreakdown={component:string;raw:number;weight:number;contribution:number;available:boolean}[];
export type RankingEvaluation={score:number;confidence:RankingConfidence;confidenceScore:number;breakdown:RankingBreakdown;limitations:string[]};

const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const finite=(value:unknown,fallback=50)=>Number.isFinite(Number(value))?Number(value):fallback;

export const BASE_WEIGHTS={scouting:.25,performance:.22,ageLevel:.09,sentiment:.12,movement:.08,risk:.06,development:.08,defense:.04,pitchQuality:.04,history:.01,consensus:.01} as const;

export function evaluateRanking(inputs:RankingInputs):RankingEvaluation{
  const limitations:string[]=[];
  const values:Record<string,number|undefined>={...inputs};
  const availableEntries=Object.entries(BASE_WEIGHTS).filter(([key])=>values[key]!==undefined&&values[key]!==null);
  const availableWeight=availableEntries.reduce((sum,[,weight])=>sum+weight,0);
  const normalizedWeight=(weight:number)=>availableWeight>0?weight/availableWeight:0;
  const breakdown:RankingBreakdown=Object.entries(BASE_WEIGHTS).map(([component,weight])=>{
    const available=values[component]!==undefined&&values[component]!==null;
    const raw=available?clamp(finite(values[component])):50;
    return{component,raw,weight:available?normalizedWeight(weight):0,contribution:available?raw*normalizedWeight(weight):0,available};
  });
  const score=clamp(breakdown.reduce((sum,item)=>sum+item.contribution,0));
  const optional=['development','defense','pitchQuality','history','consensus'];
  const optionalCoverage=optional.filter(key=>values[key]!==undefined&&values[key]!==null).length/optional.length;
  const coreCoverage=['scouting','performance','ageLevel','sentiment','movement','risk'].filter(key=>values[key]!==undefined&&values[key]!==null).length/6;
  const confidenceScore=clamp(coreCoverage*65+optionalCoverage*35);
  if(values.defense===undefined)limitations.push('Defensive-quality input unavailable.');
  if(values.pitchQuality===undefined)limitations.push('Pitch-quality input unavailable.');
  if(values.history===undefined)limitations.push('Historical calibration input unavailable.');
  if(values.consensus===undefined)limitations.push('External consensus validation unavailable.');
  const confidence:RankingConfidence=confidenceScore>=82?'high':confidenceScore>=55?'moderate':'low';
  return{score:Number(score.toFixed(1)),confidence,confidenceScore:Math.round(confidenceScore),breakdown,limitations};
}

export function consensusScore(pulseRank:number,externalRanks:number[],fieldSize=30){
  if(!externalRanks.length)return null;
  const mean=externalRanks.reduce((sum,value)=>sum+value,0)/externalRanks.length;
  const agreement=clamp(100-Math.abs(pulseRank-mean)*(100/Math.max(fieldSize,1)));
  return{meanRank:Number(mean.toFixed(1)),difference:Number((mean-pulseRank).toFixed(1)),agreement:Number(agreement.toFixed(1)),sourceCount:externalRanks.length};
}

export function rankCorrelation(predicted:number[],actual:number[]){
  if(predicted.length!==actual.length||predicted.length<2)return null;
  const n=predicted.length;
  const sumSquared=predicted.reduce((sum,value,index)=>sum+(value-actual[index])**2,0);
  return Number((1-(6*sumSquared)/(n*(n*n-1))).toFixed(3));
}
