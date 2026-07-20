import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const payload=JSON.parse(fs.readFileSync(path.join(root,'data/stats.json'),'utf8'));
const records=payload.records||[];
const season=payload.season||new Date().getUTCFullYear();
const teams=[
  {id:143,name:'Philadelphia Phillies',level:'MLB'},
  {id:1410,name:'Lehigh Valley IronPigs',level:'AAA'},
  {id:522,name:'Reading Fightin Phils',level:'AA'},
  {id:427,name:'Jersey Shore BlueClaws',level:'A+'},
  {id:566,name:'Clearwater Threshers',level:'A'},
  {id:469,name:'FCL Phillies',level:'Rookie'}
];

async function fetchJson(url){
  const response=await fetch(url,{headers:{'User-Agent':'Phillies-Prospect-Pulse/1.0'}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

const official=[];
for(const team of teams){
  const data=await fetchJson(`https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=active&season=${season}`);
  for(const entry of data.roster||[]){
    const playerId=entry.person?.id;
    const player=entry.person?.fullName;
    if(playerId&&player)official.push({playerId,player,affiliate:team.name,level:team.level,status:entry.status?.description||null});
  }
}

const duplicateOfficial=[];
const officialById=new Map();
for(const row of official){
  if(officialById.has(row.playerId))duplicateOfficial.push({playerId:row.playerId,player:row.player,assignments:[officialById.get(row.playerId),row]});
  else officialById.set(row.playerId,row);
}
const appById=new Map(records.map(row=>[row.playerId,row]));
const missing=[];
const extra=[];
const mismatches=[];

for(const [playerId,row] of officialById){
  const app=appById.get(playerId);
  if(!app){missing.push(row);continue;}
  if(app.affiliate!==row.affiliate||app.level!==row.level)mismatches.push({playerId,player:row.player,appAffiliate:app.affiliate,appLevel:app.level,officialAffiliate:row.affiliate,officialLevel:row.level});
}
for(const [playerId,row] of appById)if(!officialById.has(playerId))extra.push({playerId,player:row.player,affiliate:row.affiliate,level:row.level,status:row.status});

console.log(`Assignment audit: ${records.length} app records vs ${officialById.size} official active-roster players.`);
console.log(`Missing: ${missing.length}; extra: ${extra.length}; mismatched: ${mismatches.length}; official duplicates: ${duplicateOfficial.length}.`);
for(const row of missing)console.error(`MISSING: ${row.player} (${row.playerId}) ${row.affiliate} ${row.level}`);
for(const row of extra)console.error(`EXTRA: ${row.player} (${row.playerId}) ${row.affiliate} ${row.level}`);
for(const row of mismatches)console.error(`MISMATCH: ${row.player} (${row.playerId}) app=${row.appAffiliate}/${row.appLevel} official=${row.officialAffiliate}/${row.officialLevel}`);
for(const row of duplicateOfficial)console.error(`OFFICIAL DUPLICATE: ${row.player} (${row.playerId}) appears on multiple active rosters`);

if(missing.length||extra.length||mismatches.length||duplicateOfficial.length)process.exit(1);
console.log('PASS: every displayed player assignment matches the official active Phillies affiliate rosters.');
