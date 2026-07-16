"use client";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Point={days_before:number;discount_pct:number};
type Preset="none"|"linear"|"progressive"|"early";

const PRESETS:{id:Preset;title:string;description:string}[]=[
 {id:"none",title:"Prix maintenu",description:"Aucune baisse automatique."},
 {id:"linear",title:"Linéaire",description:"Baisse régulière jusqu’à l’arrivée."},
 {id:"progressive",title:"Progressive",description:"Très douce au début, plus forte près de l’arrivée."},
 {id:"early",title:"Anticipée",description:"Réagit plus tôt puis ralentit à l’approche."},
];
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export function buildCurve(preset:Preset,horizon:number,maxDiscount:number):Point[]{
 const h=Math.max(7,Math.round(horizon));const m=clamp(maxDiscount,0,80);
 if(preset==="none")return[{days_before:h,discount_pct:0},{days_before:0,discount_pct:0}];
 if(preset==="linear")return[{days_before:h,discount_pct:0},{days_before:0,discount_pct:m}];
 if(preset==="early")return[
  {days_before:h,discount_pct:0},{days_before:Math.round(h*.75),discount_pct:m*.4},
  {days_before:Math.round(h*.5),discount_pct:m*.7},{days_before:Math.round(h*.25),discount_pct:m*.9},{days_before:0,discount_pct:m}
 ];
 return[
  {days_before:h,discount_pct:0},{days_before:Math.round(h*.5),discount_pct:m*.12},
  {days_before:Math.round(h*.25),discount_pct:m*.42},{days_before:Math.min(7,Math.round(h*.12)),discount_pct:m*.82},{days_before:0,discount_pct:m}
 ];
}
function MiniGraph({preset,selected}:{preset:Preset;selected:boolean}){
 const pts=buildCurve(preset,100,30);const coords=pts.map(p=>`${8+(100-p.days_before)*1.04},${8+p.discount_pct*1.7}`).join(" ");
 return <svg viewBox="0 0 120 64" role="img" aria-label={preset} style={{width:"100%",height:58,display:"block"}}>
  <path d="M8 8V57H114" fill="none" stroke="#cbd5e1" strokeWidth="1"/>
  <polyline points={coords} fill="none" stroke={selected?"#ea580c":"#334155"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>
}
export default function CurvePresetSelector({namePrefix="",initialPreset="progressive",initialHorizon=120,initialMaxDiscount=30,mode="custom",allowInherit=false}:{namePrefix?:string;initialPreset?:string;initialHorizon?:number;initialMaxDiscount?:number;mode?:string;allowInherit?:boolean}){
 const [curveMode,setCurveMode]=useState(mode);const [preset,setPreset]=useState<Preset>((PRESETS.some(x=>x.id===initialPreset)?initialPreset:"progressive") as Preset);
 const [horizon,setHorizon]=useState(Number(initialHorizon)||120);const [maxDiscount,setMaxDiscount]=useState(Number(initialMaxDiscount)||30);
 const curve=useMemo(()=>buildCurve(preset,horizon,maxDiscount),[preset,horizon,maxDiscount]);const disabled=allowInherit&&curveMode!=="custom";
 return <div style={{display:"grid",gap:14}}>
  {allowInherit&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
   {[{id:"inherit",label:"Hériter de la stratégie générale"},{id:"custom",label:"Courbe propre à cette saison"},{id:"none",label:"Aucune baisse temporelle"}].map(x=><label key={x.id} style={pill(curveMode===x.id)}><input type="radio" name={`${namePrefix}optimisation_mode`} value={x.id} checked={curveMode===x.id} onChange={()=>setCurveMode(x.id)}/>{x.label}</label>)}
  </div>}
  <fieldset disabled={disabled} style={{border:0,padding:0,margin:0,opacity:disabled ? 0.55 : 1,display:"grid",gap:14}}>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
    {PRESETS.map(x=><label key={x.id} style={card(preset===x.id)}><input type="radio" name={`${namePrefix}optimisation_preset`} value={x.id} checked={preset===x.id} onChange={()=>setPreset(x.id)} style={{position:"absolute",opacity:0}}/><MiniGraph preset={x.id} selected={preset===x.id}/><b>{x.title}</b><small style={{color:"#64748b",lineHeight:1.35}}>{x.description}</small></label>)}
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
    <label style={field}>Début de l’optimisation (J-)<input name={`${namePrefix}optimisation_horizon_days`} type="number" min="7" max="730" value={horizon} onChange={e=>setHorizon(Number(e.target.value))} style={input}/><small style={hint}>Avant cet horizon, aucune baisse temporelle.</small></label>
    <label style={field}>Réduction maximale<input name={`${namePrefix}optimisation_max_discount_pct`} type="number" min="0" max="80" step="1" value={maxDiscount} onChange={e=>setMaxDiscount(Number(e.target.value))} style={input}/><small style={hint}>Maximum atteint à J-0, avant application du plancher.</small></label>
   </div>
  </fieldset>
  <input type="hidden" name={`${namePrefix}optimisation_curve`} value={JSON.stringify(curve)}/>
  {!allowInherit&&<input type="hidden" name={`${namePrefix}optimisation_mode`} value="custom"/>}
  {allowInherit&&curveMode!=="custom"&&<input type="hidden" name={`${namePrefix}optimisation_preset`} value={preset}/>} 
 </div>
}
const field:CSSProperties={display:"grid",gap:6,fontWeight:600};const input:CSSProperties={font:"inherit",padding:"10px 11px",border:"1px solid #cbd5e1",borderRadius:9};const hint:CSSProperties={fontWeight:400,color:"#64748b"};
const card=(active:boolean):CSSProperties=>({position:"relative",display:"grid",gap:5,padding:10,border:`2px solid ${active?"#ea580c":"#e2e8f0"}`,borderRadius:12,background:active?"#fff7ed":"white",cursor:"pointer"});
const pill=(active:boolean):CSSProperties=>({display:"inline-flex",gap:7,alignItems:"center",padding:"8px 10px",border:`1px solid ${active?"#ea580c":"#cbd5e1"}`,borderRadius:999,background:active?"#fff7ed":"white",cursor:"pointer"});
