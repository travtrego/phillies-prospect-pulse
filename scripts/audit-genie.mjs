import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const datasets={rankings:read('data/rankings.json').records||[],stats:read('data/stats.json').records||[],injuries:read('data/injuries.json').records||[],promotions:read('data/promotions.json').records||[]};
const normalize=(value='')=>String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const failures=[];
const warnings=[];
const assert=(condition,message)=>{if(!condition)failures.push(message)};

assert(datasets.rankings.length>0,'rankings.json contains no records');
assert(datasets.stats.length>0,'stats.json contains no records');
for(const [name,rows] of Object.entries(datasets)){
  assert(Array.isArray(rows),`${name} records is not an array`);
  const names=rows.map(row=>normalize(row.player)).filter(Boolean);
  const duplicates=[...new Set(names.filter((value,index)=>names.indexOf(value)!==index))];
  if(duplicates.length)warnings.push(`${name} has duplicate player names: ${duplicates.join(', ')}`);
  rows.forEach((row,index)=>{
    assert(Boolean(normalize(row.player)),`${name}[${index}] is missing player`);
  });
}

datasets.rankings.forEach((row,index)=>{
  assert(Number.isFinite(Number(row.rank)),`rankings[${index}] has invalid rank`);
  assert(Number.isFinite(Number(row.score)),`rankings[${index}] has invalid score`);
  assert(Number(row.score)>=0&&Number(row.score)<=100,`rankings[${index}] score is outside 0-100`);
  assert(Boolean(row.position),`rankings[${index}] is missing position`);
  assert(Boolean(row.level||row.affiliate),`rankings[${index}] is missing level and affiliate`);
});

const rankingNames=new Set(datasets.rankings.map(row=>normalize(row.player)));
for(const source of ['stats','injuries','promotions']){
  const orphans=datasets[source].filter(row=>!rankingNames.has(normalize(row.player))).map(row=>row.player);
  if(orphans.length)warnings.push(`${source} contains players absent from rankings: ${orphans.slice(0,10).join(', ')}`);
}

for(const row of datasets.stats){
  if(!row.stats)continue;
  assert(['hitting','pitching'].includes(row.stats.type),`stats record for ${row.player} has unsupported type ${row.stats.type}`);
  if(row.stats.type==='hitting'){
    for(const key of ['average','obp','slg','ops'])if(row.stats[key]!=null)assert(Number.isFinite(Number(row.stats[key])),`${row.player} has invalid ${key}`);
  }
  if(row.stats.type==='pitching'){
    for(const key of ['era','whip','kPer9','bbPer9'])if(row.stats[key]!=null)assert(Number.isFinite(Number(row.stats[key])),`${row.player} has invalid ${key}`);
  }
}

console.log(`Genie audit: ${datasets.rankings.length} rankings, ${datasets.stats.length} stat records, ${datasets.injuries.length} injury records, ${datasets.promotions.length} promotion records.`);
for(const warning of warnings)console.warn(`WARNING: ${warning}`);
if(failures.length){
  for(const failure of failures)console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: Genie source data passed structural and range checks.');
