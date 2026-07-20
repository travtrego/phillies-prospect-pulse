import { isDevelopmentQuestion } from './development';
import { isFrontOfficeQuestion } from './frontoffice';
import { isOrganizationQuestion } from './organization';
import { isPredictiveFrontOfficeQuestion } from './predictiveFrontOffice';
import { isSimulationQuestion } from './simulation';

export type GenieRoute='predictive_front_office'|'development_dossier'|'front_office_decision'|'simulation'|'organization'|'core';

const explicitDossier=(question:string)=>/dossier|living scouting|current focus|next milestone|skill trajectory/i.test(question);
const broadDevelopmentList=(question:string)=>/^(?:who|which|show|list|rank|give me).*(?:improv|develop|trend|progress|regress)/i.test(question.trim());
const datedForecast=(question:string)=>/(?:phillies|roster|organization|farm system).*(?:2027|2028|2029|2030)|(?:2027|2028|2029|2030).*(?:phillies|roster|organization|farm system)/i.test(question);

export function selectGenieRoute(question:string,matchedPlayerCount:number):GenieRoute{
  if(isPredictiveFrontOfficeQuestion(question)||datedForecast(question))return'predictive_front_office';
  if(isDevelopmentQuestion(question)&&!broadDevelopmentList(question)&&(matchedPlayerCount>0||explicitDossier(question)))return'development_dossier';
  if(isFrontOfficeQuestion(question))return'front_office_decision';
  if(isSimulationQuestion(question))return'simulation';
  if(isOrganizationQuestion(question)&&matchedPlayerCount===0)return'organization';
  return'core';
}
