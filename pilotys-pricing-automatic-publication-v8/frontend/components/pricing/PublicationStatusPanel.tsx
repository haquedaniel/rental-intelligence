import type {CSSProperties} from "react";

type Row=Record<string,any>;
export default function PublicationStatusPanel({settings,actions}:{settings:Row|null;actions:Row[]}){
 const s=settings||{};const live=s.mode==="apply";const paused=Boolean(s.publication_paused);
 const pending=actions.filter(x=>["proposed","applying","failed"].includes(x.status)).length;
 const failed=actions.filter(x=>["failed","validation_failed"].includes(x.status)).length;
 const applied=actions.filter(x=>x.status==="applied").length;
 return <section style={panel}>
  <div><div style={eyebrow}>DIFFUSION DES PRIX</div><h2 style={{margin:"3px 0 6px"}}>{!live?"Aperçu Pilotys":paused?"Diffusion en pause":"En direct sur les plateformes"}</h2>
   <p style={{margin:0,color:"#475569",lineHeight:1.45}}>{!live?"Les prix sont calculés mais ne sont pas visibles par les voyageurs.":paused?"Les changements restent en attente jusqu’à la reprise.":"Chaque nouveau prix est mis en ligne automatiquement, puis contrôlé par une nouvelle simulation voyageur."}</p></div>
  <div style={stats}><Stat value={pending} label="en attente"/><Stat value={applied} label="validés récents"/><Stat value={failed} label="à vérifier" danger={failed>0}/></div>
  {s.publication_last_error&&<div style={error}>{s.publication_last_error}</div>}
  <div style={meta}>Dernier contrôle : {s.publication_last_run_at?new Date(s.publication_last_run_at).toLocaleString("fr-FR"):"pas encore exécuté"}</div>
 </section>
}
function Stat({value,label,danger=false}:{value:number;label:string;danger?:boolean}){return <div style={{...stat,borderColor:danger?"#fecaca":"#dbeafe",background:danger?"#fef2f2":"#eff6ff"}}><strong style={{fontSize:22,color:danger?"#b91c1c":"#1d4ed8"}}>{value}</strong><span>{label}</span></div>}
const panel:CSSProperties={display:"grid",gap:15,border:"1px solid #bfdbfe",borderRadius:18,padding:18,marginBottom:20,background:"linear-gradient(135deg,#eff6ff,#fff)"};const eyebrow:CSSProperties={fontSize:11,fontWeight:900,letterSpacing:".08em",color:"#2563eb"};const stats:CSSProperties={display:"flex",gap:9,flexWrap:"wrap"};const stat:CSSProperties={display:"grid",minWidth:105,gap:1,padding:"8px 11px",border:"1px solid",borderRadius:12,fontSize:12,color:"#475569"};const error:CSSProperties={padding:10,borderRadius:10,background:"#fef2f2",color:"#991b1b"};const meta:CSSProperties={fontSize:12,color:"#64748b"};
