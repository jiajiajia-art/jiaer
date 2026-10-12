import type { GameState } from "../lib/types";
import { PEOPLE } from "../worlds/star2005/content";
export type LifeRules = { enabled: boolean; bands: { min: number; max: number }[]; maxAge: number; declineAge: number; threshold: number; base: number; ageRate: number; healthWeight: number; cap: number; decline: number };
export const LIFE_DEFAULT: LifeRules = { enabled: false, bands: [{min:0,max:17},{min:18,max:35},{min:36,max:59},{min:60,max:79},{min:80,max:120}], maxAge:120, declineAge:60, threshold:0, base:0, ageRate:0.001, healthWeight:0.01, cap:10, decline:1 };
export function applyLifecycle(g: GameState): GameState {
 const r=g.sim.lifeRules??LIFE_DEFAULT;
 const people=[...new Map([...PEOPLE,...g.sim.npcs,...g.npcs].map(n=>[n.id,n])).values()];
 const lives={...g.sim.npcLives};
 for(const n of people){
  const profile=PEOPLE.find(p=>p.id===n.id);
  const rawAge=g.npcFieldValues?.[n.id]?.age ?? ("age" in n ? n.age : profile?.age);
  const age=rawAge === "" || rawAge == null ? NaN : Number(rawAge);
  let life=lives[n.id]??{age:Number.isFinite(age)&&age>=0?age:null,health:100,dead:profile?.status==="dead",lastDay:g.sim.day};
  life={...life};
  if(life.age===null && Number.isFinite(age) && age>=0) life.age=age;
  const elapsed=Math.max(0,g.sim.day-life.lastDay);
  if(r.enabled&&!life.dead&&life.age!==null) for(let i=0;i<elapsed;i++){
   life.age+=1/365.25;
   if(life.age>=r.declineAge) life.health=Math.max(0,life.health-r.decline/365.25);
   const rate=Math.min(r.cap,Math.max(0,r.base+Math.max(0,life.age-r.declineAge)*r.ageRate+(100-life.health)/100*r.healthWeight));
   if(life.age>=r.maxAge||life.health<=r.threshold||Math.random()*100<rate){life.dead=true;life.deathDay=life.lastDay+i+1;break;}
  }
  life.lastDay=g.sim.day;lives[n.id]=life;
 }
 return {...g,sim:{...g.sim,npcLives:lives}};
}
