import type { GenieLevel } from './config';

export function normalizeText(value:unknown=''){
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9+ ]/g,' ').replace(/\s+/g,' ').trim();
}

export function clamp(value:number,min=0,max=100){
  return Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
}

export function finite(value:unknown,fallback=0){
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
}

export function positionGroup(position:unknown){
  const value=String(position||'').toUpperCase();
  if(['RHP','LHP','P','SP','RP'].includes(value))return'Pitching';
  if(value==='C')return'Catcher';
  if(['SS','2B','3B','1B','IF'].includes(value))return'Infield';
  if(['CF','LF','RF','OF'].includes(value))return'Outfield';
  return'Other';
}

export function isGenieLevel(value:unknown):value is GenieLevel{
  return ['Rookie','A','A+','AA','AAA','MLB'].includes(String(value));
}

export function indexByPlayer<T extends {player?:unknown}>(rows:T[]){
  const map=new Map<string,T>();
  for(const row of rows){
    const key=normalizeText(row.player);
    if(key&&!map.has(key))map.set(key,row);
  }
  return map;
}

export function groupByPlayer<T extends {player?:unknown}>(rows:T[]){
  const map=new Map<string,T[]>();
  for(const row of rows){
    const key=normalizeText(row.player);
    if(!key)continue;
    const group=map.get(key)||[];
    group.push(row);
    map.set(key,group);
  }
  return map;
}
