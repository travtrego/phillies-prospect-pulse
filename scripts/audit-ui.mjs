import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const readText=file=>fs.readFileSync(path.join(root,file),'utf8');
const readJson=file=>JSON.parse(readText(file));
const failures=[];
const warnings=[];
const assert=(condition,message)=>{if(!condition)failures.push(message)};
const exists=file=>fs.existsSync(path.join(root,file));
const normalize=(value='')=>String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();

const requiredPages=['app/page.tsx','app/rankings/page.tsx','app/affiliates/page.tsx','app/news/page.tsx','app/promotions/page.tsx','app/injuries/page.tsx','app/prospect-genie/page.tsx','app/players/[id]/page.tsx'];
for(const page of requiredPages)assert(exists(page),`Required tab/page is missing: ${page}`);

const layout=readText('app/layout.tsx');
for(const href of ['/','/rankings','/prospect-genie','/affiliates','/news','/promotions','/injuries'])assert(layout.includes(`href="${href}"`),`Main navigation is missing ${href}`);

const directory=readText('app/ProspectDirectory.tsx');
for(const field of ['full_name','primary_position','current_level','current_team_name','bats','throws','draft_year','estimated_arrival_year','scouting_summary'])assert(directory.includes(`player.${field}`),`Player card does not present ${field}`);
assert(directory.includes('cardFooter'),'Player card footer is not using the styled cardFooter class');
assert(directory.includes('aria-selected'),'Player card filter tabs do not expose selected state');
assert(directory.includes('No players match this filter.'),'Player directory lacks a useful empty state');

const profile=readText('app/players/[id]/page.tsx');
for(const anchor of ['#bio','#stats','#scouting','#injury','#movement'])assert(profile.includes(`href="${anchor}"`),`Player profile subnav is missing ${anchor}`);
for(const section of ['id="bio"','id="stats"','id="scouting"','id="injury"','id="movement"'])assert(profile.includes(section),`Player profile target is missing ${section}`);
assert(profile.includes('getDirectoryPlayer'),'Player profiles are not using the resilient player loader');

const playerDirectory=readText('lib/playerDirectory.ts');
assert(playerDirectory.includes('current_level:stat?.level||record.level||null'),'Local directory players do not prioritize the current stats level over the preseason ranking level');
assert(playerDirectory.includes('current_team_name:stat?.affiliate||record.affiliate||null'),'Local directory players do not prioritize the current stats affiliate over the preseason ranking affiliate');
assert(playerDirectory.includes('current_level:stat?.level||player.current_level'),'Remote directory players do not allow the fresher stats level to override stale stored assignments');
assert(playerDirectory.includes('current_team_name:stat?.affiliate||player.current_team_name'),'Remote directory players do not allow the fresher stats affiliate to override stale stored assignments');

const home=readText('app/page.tsx');
const affiliates=readText('app/affiliates/page.tsx');
const newsPage=readText('app/news/page.tsx');
const promotionsPage=readText('app/promotions/page.tsx');
const injuriesPage=readText('app/injuries/page.tsx');
const rankingsPage=readText('app/rankings/page.tsx');
assert(home.includes('getDirectoryPlayers'),'Homepage cards are not using the resilient player loader');
assert(home.includes('enrichRankings'),'Homepage cards are not using canonical v4 rankings');
assert(affiliates.includes('getDirectoryPlayers'),'Affiliates tab is not using the resilient player loader');
for(const [name,page,feed] of [['News',newsPage,'newsFeed.updatedAt'],['Promotions',promotionsPage,'promotionFeed.updatedAt'],['Injuries',injuriesPage,'injuryFeed.updatedAt']]){
  assert(page.includes(feed),`${name} presentation does not expose the source refresh timestamp`);
  assert(page.includes('Every 6 hours'),`${name} presentation does not disclose the automation cadence`);
}
assert(rankingsPage.includes('rankingsData.updatedAt'),'Rankings presentation does not expose ranking refresh time');

const datasets=['news.json','stats.json','promotions.json','injuries.json','rankings.json'];
for(const file of datasets){
  const payload=readJson(`data/${file}`);
  assert(Boolean(payload.updatedAt),`${file} lacks updatedAt freshness metadata`);
  assert(!Number.isNaN(new Date(payload.updatedAt).getTime()),`${file} has an invalid updatedAt timestamp`);
}

const rankingPayload=readJson('data/rankings.json');
const rankings=rankingPayload.records||[];
const stats=readJson('data/stats.json').records||[];
const statNames=new Set(stats.map(row=>normalize(row.player)));
assert(rankings.length>=30,`Expected at least 30 ranking records; found ${rankings.length}`);
for(const row of rankings.slice(0,30)){
  assert(Boolean(row.playerId),`Top-30 record ${row.player} lacks a profile link ID`);
  assert(Boolean(row.player),`Top-30 record at rank ${row.rank} lacks a name`);
  assert(Boolean(row.position),`${row.player} lacks a card position`);
  assert(Boolean(row.level),`${row.player} lacks a card level`);
  assert(Number.isFinite(Number(row.score)),`${row.player} lacks a numeric ranking score`);
  if(!statNames.has(normalize(row.player)))warnings.push(`${row.player} has no current stat record; profile will show an explicit empty stat state.`);
}
const gageWood=stats.find(row=>normalize(row.player)==='gage wood');
assert(Boolean(gageWood),'Current stats feed is missing Gage Wood');
assert(gageWood?.level==='AA',`Gage Wood current level must be AA; found ${gageWood?.level||'missing'}`);
assert(/reading/i.test(String(gageWood?.affiliate||'')),`Gage Wood current affiliate must be Reading; found ${gageWood?.affiliate||'missing'}`);

const workflowPath='.github/workflows/refresh-prospect-data.yml';
assert(exists(workflowPath),'Timed prospect refresh workflow is missing');
if(exists(workflowPath)){
  const workflow=readText(workflowPath);
  for(const marker of ["cron: '17 */6 * * *'",'workflow_dispatch:','contents: write','npm run update:all','npm run quality','git push origin main'])assert(workflow.includes(marker),`Refresh workflow is missing required automation marker: ${marker}`);
  const order=['update:news','update:stats','update:promotions','update:injuries','update:rankings'];
  const packageJson=readText('package.json');
  for(const command of order)assert(packageJson.includes(`"${command}"`),`package.json is missing ${command}`);
  const allLine=packageJson.split('\n').find(line=>line.includes('"update:all"'))||'';
  let previous=-1;
  for(const command of order){const index=allLine.indexOf(command);assert(index>previous,`update:all dependency order is incorrect around ${command}`);previous=index;}
}

const layers={1:['lib/genie/parser.ts','lib/genie/engine.ts'],2:['lib/genie/parser.ts'],3:['lib/genie/writer.ts'],4:['lib/genie/engine.ts'],5:['lib/genie/projections.ts'],6:['lib/genie/organization.ts'],7:['lib/genie/simulation.ts'],8:['lib/genie/frontoffice.ts'],9:['lib/genie/development.ts','lib/genie/history.ts'],10:['lib/genie/predictiveFrontOffice.ts']};
for(const [layer,files] of Object.entries(layers))for(const file of files)assert(exists(file),`Genie layer ${layer} is missing ${file}`);
const route=readText('app/api/prospect-genie/route.ts');
for(const marker of ['parseIntent','runEngine','applyHistoricalIntelligence','analyzeOrganization','simulateScenario','buildFrontOfficeReport','buildDevelopmentDossier','buildPredictiveFrontOfficeReport','finalizeGeniePayload','selectGenieRoute'])assert(route.includes(marker),`Genie route is not wired to ${marker}`);
assert(route.includes('Prospect Genie Predictive Front Office v10.0'),'Genie API does not identify the predictive front office as v10.0');
const reliability=readText('lib/genie/reliability.ts');
assert(!reliability.includes('GENIE_LAYER_10_VERSION'),'Internal reliability guardrail is incorrectly labeled as Genie layer 10');

console.log(`UI audit: ${requiredPages.length} pages, ${rankings.length} rankings, ${datasets.length} timed datasets and Genie layers 1-10 inspected.`);
for(const warning of warnings.slice(0,20))console.warn(`WARNING: ${warning}`);
if(failures.length){for(const failure of failures)console.error(`FAIL: ${failure}`);process.exit(1)}
console.log('PASS: automation, freshness metadata, current affiliate precedence, presentation surfaces, player cards, profile tabs, navigation and Genie layers 1-10 passed integration checks.');
