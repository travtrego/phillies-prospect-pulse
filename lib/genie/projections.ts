import type { GenieMetric, PlayerEvidence } from './types';

const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const levelValue=(level?:string)=>({MLB:100,AAA:82,AA:64,'A+':46,A:30,Rookie:14}[level||'']||18);

export type ProjectionSet={
  mlbProbability:number;
  promotionProbability:number;
  breakoutProbability:number;
  tradeValue:number;
  protectScore:number;
  volatility:number;
  recommendation:string;
  rationale:string[];
};

export function projectPlayer(item:PlayerEvidence):ProjectionSet{
  const s=item.scores;
  const age=Number(item.stat?.currentAge||item.player.age||23);
  const level=item.stat?.level||item.player.level;
  const youthBonus=clamp((25-age)*5,-10,25);
  const healthPenalty=item.injury?18:0;
  const promotionHistory=Math.min(12,item.promotions.length*4);
  const readinessBase=levelValue(level);

  const mlbProbability=clamp(s.ceiling*.28+s.floor*.22+s.readiness*.34+s.performance*.16-healthPenalty);
  const promotionProbability=clamp(readinessBase*.25+s.performance*.32+s.momentum*.33+promotionHistory-healthPenalty);
  const breakoutProbability=clamp(s.ceiling*.34+s.momentum*.34+s.performance*.18+youthBonus-healthPenalty-s.risk*.08);
  const tradeValue=clamp(s.ceiling*.38+s.floor*.18+s.performance*.16+s.readiness*.12+youthBonus+s.momentum*.1-healthPenalty);
  const protectScore=clamp(tradeValue*.42+mlbProbability*.22+s.ceiling*.2+s.floor*.16);
  const volatility=clamp(s.risk*.55+Math.abs(s.ceiling-s.floor)*.45);

  const rationale:string[]=[];
  if(s.ceiling>=70)rationale.push('impact-level upside');
  if(s.floor>=65)rationale.push('a relatively stable floor');
  if(s.readiness>=70)rationale.push('near-term major-league proximity');
  if(s.momentum>=70)rationale.push('strong recent momentum');
  if(s.performance>=70)rationale.push('high current production');
  if(youthBonus>=15)rationale.push('age advantage for the level');
  if(item.injury)rationale.push('an active health discount');
  if(s.risk>=65)rationale.push('meaningful developmental risk');

  let recommendation='Monitor';
  if(protectScore>=78)recommendation='Untouchable core prospect';
  else if(protectScore>=66)recommendation='Protect and develop';
  else if(tradeValue>=62&&volatility>=58)recommendation='High-value trade chip';
  else if(promotionProbability>=72)recommendation='Promotion candidate';
  else if(breakoutProbability>=68)recommendation='Breakout watch';

  return{mlbProbability,promotionProbability,breakoutProbability,tradeValue,protectScore,volatility,recommendation,rationale:rationale.slice(0,4)};
}

export function decisionMetric(question:string):keyof ProjectionSet|null{
  const q=question.toLowerCase();
  if(/untouchable|protect|rule 5|refuse to trade/.test(q))return'protectScore';
  if(/trade value|trade chip|deal|trade/.test(q))return'tradeValue';
  if(/breakout|break through|surprise/.test(q))return'breakoutProbability';
  if(/promot|move up|next level/.test(q))return'promotionProbability';
  if(/reach.*major|make.*mlb|major league probability|become.*major/.test(q))return'mlbProbability';
  if(/volatile|boom or bust/.test(q))return'volatility';
  return null;
}

export function projectionMetricLabel(metric:keyof ProjectionSet){
  return({mlbProbability:'MLB probability',promotionProbability:'promotion probability',breakoutProbability:'breakout probability',tradeValue:'trade value',protectScore:'protection priority',volatility:'volatility',recommendation:'recommendation',rationale:'rationale'} as Record<string,string>)[metric]||metric;
}
