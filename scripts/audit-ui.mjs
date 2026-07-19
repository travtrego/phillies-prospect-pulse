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

const home=readText('app/page.tsx');
const affiliates=readText('app/affiliates/page.tsx');
assert(home.includes('getDirectoryPlayers'),'Homepage cards are not using the resilient player loader');
assert(affiliates.includes('getDirectoryPlayers'),'Affiliates tab is not using the resilient player loader');

const rankings=readJson('data/rankings.json').records||[];
const stats=readJson('data/stats.json').records||[];
const rankingNames=new Set(rankings.map(row=>normalize(row.player)));
const statNames=new Set(stats.map(row=>normalize(row.player)));
assert(rankings.length>=30,`Expected at least 30 ranking records; found ${rankings.length}`);
for(const row of rankings.slice(0,30)){
  assert(Boolean(row.playerId),`Top-30 record ${row.player} lacks a profile link ID`);
  assert(Boolean(row.player),`Top-30 record at rank ${row.rank} lacks a name`);
  assert(Boolean(row.position),`${row.player} lacks a card position`);
  assert(Boolean(row.level),`${row.player} lacks a card level`);
  if(!statNames.has(normalize(row.player)))warnings.push(`${row.player} has no current stat record; profile will show an explicit empty stat state.`);
}

const layers={
  1:['lib/genie/parser.ts','lib/genie/engine.ts'],
  2:['lib/genie/parser.ts'],
  3:['lib/genie/writer.ts'],
  4:['lib/genie/engine.ts'],
  5:['lib/genie/projections.ts'],
  6:['lib/genie/organization.ts'],
  7:['lib/genie/simulation.ts'],
  8:['lib/genie/frontoffice.ts'],
  9:['lib/genie/development.ts','lib/genie/history.ts']
};
for(const [layer,files] of Object.entries(layers))for(const file of files)assert(exists(file),`Genie layer ${layer} is missing ${file}`);
const route=readText('app/api/prospect-genie/route.ts');
for(const marker of ['parseIntent','runEngine','applyHistoricalIntelligence','analyzeOrganization','simulateScenario','buildFrontOfficeReport','buildDevelopmentDossier'])assert(route.includes(marker),`Genie route is not wired to ${marker}`);
assert(route.includes('development intelligence v9.0'),'Genie API does not identify itself as v9.0');

console.log(`UI audit: ${requiredPages.length} pages, ${rankings.length} rankings and Genie layers 1-9 inspected.`);
for(const warning of warnings.slice(0,20))console.warn(`WARNING: ${warning}`);
if(failures.length){for(const failure of failures)console.error(`FAIL: ${failure}`);process.exit(1)}
console.log('PASS: player cards, profile tabs, navigation tabs and Genie layers 1-9 passed static integration checks.');
