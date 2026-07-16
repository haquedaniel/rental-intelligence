"use client";
import type {CSSProperties,ReactNode} from "react";
import CurvePresetSelector from "./CurvePresetSelector";
import SubmitStatusButton from "./SubmitStatusButton";
type Row=Record<string,any>;
const input={font:"inherit",padding:"10px 11px",border:"1px solid #cbd5e1",borderRadius:9,width:"100%"} as const;
const field={display:"grid",gap:6,fontWeight:600} as const;
const hint={fontWeight:400,color:"#64748b",fontSize:12} as const;
export default function PricingSettingsForm({settings,hiddenFields,action}:{settings:Row|null;hiddenFields:ReactNode;action:(f:FormData)=>void}){const s=settings||{};return <form action={action} style={{display:"grid",gap:22}}>
 {hiddenFields}
 <div style={group}><h3 style={heading}>Tarifs de référence</h3><div style={grid}>
  <label style={field}>Prix semaine<input name="default_price" type="number" step=".01" defaultValue={s.default_price??100} style={input}/></label>
  <label style={field}>Prix vendredi / samedi<input name="default_weekend_price" type="number" step=".01" defaultValue={s.default_weekend_price??""} style={input}/></label>
  <label style={field}>Plancher<input name="floor_price" type="number" step=".01" defaultValue={s.floor_price??50} style={input}/><small style={hint}>Prix final minimum, quelle que soit la courbe.</small></label>
  <label style={field}>Plafond<input name="ceiling_price" type="number" step=".01" defaultValue={s.ceiling_price??""} style={input}/></label>
  <label style={field}>Séjour minimum<input name="default_min_stay" type="number" min="1" defaultValue={s.default_min_stay??2} style={input}/></label>
 </div></div>
 <div style={group}><h3 style={heading}>Optimisation temporelle</h3><p style={intro}>Choisissez la forme de la baisse. La courbe s’applique immédiatement selon le nombre de jours restant avant l’arrivée.</p><CurvePresetSelector initialPreset={s.optimisation_preset??"progressive"} initialHorizon={s.optimisation_horizon_days??120} initialMaxDiscount={s.optimisation_max_discount_pct??30}/><label style={{...field,display:"flex",gridTemplateColumns:"auto 1fr",alignItems:"center",gap:9}}><input name="protect_weekends" type="checkbox" defaultChecked={s.protect_weekends??true}/> Protéger les vendredis et samedis de cette baisse</label></div>
 <div style={group}><h3 style={heading}>Signaux et opportunités</h3><div style={grid}>
  <label style={field}>Prime nuit isolée<input name="one_night_gap_multiplier" type="number" step=".05" defaultValue={s.one_night_gap_multiplier??1.5} style={input}/></label>
  <label style={field}>Libérer une nuit isolée à J-<input name="one_night_release_days" type="number" defaultValue={s.one_night_release_days??21} style={input}/></label>
  <label style={field}>Influence Goyen (%)<input name="market_signal_influence_pct" type="number" min="0" max="100" step="5" defaultValue={s.market_signal_influence_pct??0} style={input}/><small style={hint}>Part du mouvement relatif du marché appliquée au prix.</small></label>
  <label style={{...field,display:"flex",alignItems:"center",gap:9}}><input name="market_signal_enabled" type="checkbox" defaultChecked={s.market_signal_enabled??false}/> Activer le signal relatif Le Goyen</label>
 </div></div>
 <div style={group}><h3 style={heading}>Fonctionnement</h3><div style={grid}>
  <label style={field}>Calendrier généré (jours)<input name="planning_horizon_days" type="number" defaultValue={s.planning_horizon_days??540} style={input}/><small style={hint}>Nombre total de jours matérialisés dans Pilotys.</small></label>
  <label style={field}>Diffusion<select name="mode" defaultValue={s.mode??"shadow"} style={input}><option value="shadow">Aperçu Pilotys — rien n’est mis en ligne</option><option value="apply">En direct — publication automatique</option></select><small style={hint}>En direct, toute modification du calendrier est publiée automatiquement puis validée.</small></label>
  <label style={{...field,display:"flex",alignItems:"center",gap:9}}><input name="enabled" type="checkbox" defaultChecked={s.enabled??false}/> Moteur actif</label>
  <label style={{...field,display:"flex",alignItems:"center",gap:9}}><input name="publication_paused" type="checkbox" defaultChecked={s.publication_paused??false}/> Mettre temporairement la diffusion en pause</label>
 </div></div>
 <label style={field}>Résumé de la modification<input name="change_summary" placeholder="Ex. courbe été plus protectrice" style={input}/></label>
 <div style={{display:"flex",justifyContent:"flex-end",gap:10,flexWrap:"wrap",position:"sticky",bottom:10,background:"rgba(255,255,255,.96)",padding:"12px 0",borderTop:"1px solid #e2e8f0"}}><button type="reset" style={{...button,background:"white",color:"#0f172a",border:"1px solid #cbd5e1"}}>Annuler les modifications</button><SubmitStatusButton/></div>
 </form>}
const group:CSSProperties={padding:"16px",border:"1px solid #e2e8f0",borderRadius:14,background:"#f8fafc"};const heading:CSSProperties={margin:"0 0 8px"};const intro:CSSProperties={margin:"0 0 16px",color:"#475569"};const grid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12};const button:CSSProperties={font:"inherit",padding:"10px 14px",borderRadius:10,cursor:"pointer"};
