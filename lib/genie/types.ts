export type GenieTask = 'player_profile' | 'compare_players' | 'rank_players' | 'trend_players' | 'injury_report' | 'promotion_report' | 'system_summary' | 'unknown';
export type GenieMetric = 'overall' | 'ceiling' | 'floor' | 'performance' | 'momentum' | 'readiness' | 'power' | 'speed' | 'contact' | 'discipline' | 'strikeouts' | 'command' | 'risk';

export type GenieFilters = {level?:string;positionType?:'pitcher'|'hitter';position?:string;international?:boolean;healthyOnly?:boolean;injuredOnly?:boolean;ageUnder?:number;ageOver?:number;etaBy?:number};
export type GenieIntent = {task:GenieTask;metric:GenieMetric;players:string[];filters:GenieFilters;limit:number;asksWhy:boolean;asksBiography:boolean;asksStats:boolean;asksProjection:boolean;asksRecent:boolean;rawQuestion:string};
export type GeniePlanStep = {tool:string;description:string};
export type GeniePlan = {intent:GenieIntent;steps:GeniePlanStep[]};
export type ProjectionDriver={factor:string;impact:number;direction:'positive'|'negative'|'neutral';explanation:string};
export type ProjectionEvidence = {mlbProbability:number;promotionProbability:number;breakoutProbability:number;tradeValue:number;protectScore:number;volatility:number;recommendation:string;rationale:string[];drivers:ProjectionDriver[]};
export type PlayerEvidence = {player:Record<string,any>;stat?:Record<string,any>;injury?:Record<string,any>;promotions:Record<string,any>[];scores:Record<GenieMetric,number>;projections?:ProjectionEvidence;strengths:string[];concerns:string[]};
export type GenieResult = {intent:GenieIntent;plan:GeniePlan;evidence:PlayerEvidence[];decisionMetric?:keyof ProjectionEvidence|null;confidence:'high'|'moderate'|'low';limitations:string[]};
