"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

type Row = Record<string, any>;
type Filter = "waiting" | "attention" | "published";

const PENDING = new Set(["pending", "queued", "proposed", "retry_pending"]);
const ACTIVE = new Set(["applying", "sending"]);
const FAILED = new Set(["failed", "validation_failed"]);

function euro(value: any) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value));
}
function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function nextTenMinuteDelay(now: Date) {
  const next = new Date(now); next.setSeconds(0, 0);
  next.setMinutes(now.getMinutes() + (now.getMinutes() % 10 === 0 ? 10 : 10 - now.getMinutes() % 10));
  return Math.max(0, next.getTime() - now.getTime());
}
function humanDelay(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000)); const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${String(seconds % 60).padStart(2, "0")} s` : `${seconds} s`;
}
function latestByDate(actions: Row[]) {
  const sorted = [...actions].sort((a,b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());
  const map = new Map<string,Row>();
  for (const row of sorted) if (!map.has(String(row.date))) map.set(String(row.date), row);
  return [...map.values()];
}

export default function PublicationStatusPanel({ settings, actions, calendar }: { settings: Row | null; actions: Row[]; calendar: Row[] }) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>("waiting");
  const [visible, setVisible] = useState(50);
  const s = settings || {};
  const live = s.mode === "apply";
  const paused = Boolean(s.publication_paused);
  const currentActions = useMemo(() => latestByDate(actions), [actions]);

  const counts = useMemo(() => {
    const publishable = calendar.filter(r => r.available !== false && !r.occupied);
    return {
      total: publishable.length,
      published: publishable.filter(r => r.publication_status === "published").length,
      active: publishable.filter(r => ACTIVE.has(String(r.publication_status || ""))).length,
      failed: publishable.filter(r => r.publication_status === "failed").length,
      pending: publishable.filter(r => !["published","not_required","failed"].includes(String(r.publication_status || "pending"))).length,
    };
  }, [calendar]);

  const initialising = live && !s.publication_initial_sync_completed_at;
  const progress = counts.total ? Math.round(counts.published / counts.total * 100) : 100;
  const hasWork = live && !paused && (counts.pending > 0 || counts.active > 0);
  const estimatedMinutes = counts.pending ? Math.ceil(counts.pending / 30) * 10 : 0;

  const lists = useMemo(() => {
    const chronological = [...currentActions].sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const waiting = chronological.filter(r => PENDING.has(String(r.status || "")) || ACTIVE.has(String(r.status || "")));
    const attention = chronological.filter(r => FAILED.has(String(r.status || "")));
    const published = [...currentActions]
      .filter(r => r.status === "applied")
      .sort((a,b) => new Date(b.applied_at || b.updated_at || 0).getTime() - new Date(a.applied_at || a.updated_at || 0).getTime());
    return { waiting, attention, published };
  }, [currentActions]);

  const selected = lists[filter].slice(0, visible);

  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => {
    if (!hasWork) return;
    const id = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [hasWork, router]);
  useEffect(() => setVisible(50), [filter]);

  const title = !live ? "Aperçu Pilotys" : paused ? "Mise en ligne suspendue" : initialising && counts.pending ? "Initialisation des prix" : counts.pending || counts.active ? "Mise à jour quotidienne en cours" : "Tous les prix sont en ligne";

  return <section style={panel}>
    <div style={topLine}>
      <div>
        <div style={eyebrow}>MISE EN LIGNE DES PRIX</div>
        <h2 style={{margin:"4px 0 6px"}}>{title}</h2>
        <p style={description}>
          {!live ? "Le calendrier est calculé, mais aucun changement n’est visible par les voyageurs."
          : paused ? "Pilotys continue de calculer les prix. Les changements attendent la reprise de la diffusion."
          : initialising && counts.pending ? "Pilotys prend en charge le calendrier initial, en commençant par les dates les plus proches."
          : counts.pending || counts.active ? "Seules les modifications réellement visibles sont transmises, par ordre chronologique."
          : "Les prix calculés par Pilotys sont synchronisés."}
        </p>
      </div>
      {live && <span style={livePill}>{paused ? "En pause" : hasWork ? "Synchronisation active" : "À jour"}</span>}
    </div>

    <div style={stats}>
      <Stat value={counts.pending} label="à publier" />
      <Stat value={counts.active} label="en cours" />
      <Stat value={counts.published} label="en ligne" good />
      <Stat value={counts.failed} label="à vérifier" danger={counts.failed>0} />
    </div>

    {live && counts.total > 0 && <div>
      <div style={progressHead}><strong>{counts.published} / {counts.total} dates en ligne</strong><span>{progress}%</span></div>
      <div style={progressTrack}><div style={{...progressBar,width:`${progress}%`}} /></div>
    </div>}

    {live && <div style={timingGrid}>
      <div><span style={minorLabel}>Prochain passage</span><strong>{paused ? "suspendu" : hasWork ? `dans ${humanDelay(nextTenMinuteDelay(now))}` : "aucun nécessaire"}</strong></div>
      <div><span style={minorLabel}>{initialising ? "Initialisation restante" : "Travail restant estimé"}</span><strong>{counts.pending ? `environ ${estimatedMinutes} min` : "terminé"}</strong></div>
      <div><span style={minorLabel}>Dernier passage</span><strong>{s.publication_last_run_at ? new Date(s.publication_last_run_at).toLocaleString("fr-FR") : "pas encore exécuté"}</strong></div>
      <div><span style={minorLabel}>Résultat exact du dernier passage</span><strong>{Number(s.publication_last_applied || 0)} accepté(s){Number(s.publication_last_reconciled || 0) ? ` · ${s.publication_last_reconciled} rapproché(s)` : ""}{Number(s.publication_last_failed || 0) ? ` · ${s.publication_last_failed} erreur(s)` : ""}</strong></div>
    </div>}

    {s.publication_last_error && <div style={error}>{s.publication_last_error}</div>}

    <div style={tabs}>
      <Tab active={filter==="waiting"} onClick={()=>setFilter("waiting")}>En attente ({lists.waiting.length})</Tab>
      <Tab active={filter==="attention"} onClick={()=>setFilter("attention")}>À vérifier ({lists.attention.length})</Tab>
      <Tab active={filter==="published"} onClick={()=>setFilter("published")}>Récemment en ligne ({lists.published.length})</Tab>
    </div>

    <div style={queue}>
      {selected.length === 0 && <div style={empty}>Aucune date dans cette catégorie.</div>}
      {selected.map(row => <div key={row.id || `${row.date}-${row.status}`} style={queueRow}>
        <div><strong>{dateLabel(row.date)}</strong><span style={queueReason}>{row.reason || "Mise à jour du prix"}</span></div>
        <div style={queuePrice}>{euro(row.target_price ?? row.target_price_eur)}<small>{row.target_min_stay ? `${row.target_min_stay} nuit(s)` : ""}</small></div>
        <StatusBadge status={String(row.status || "")}/>
      </div>)}
    </div>
    {lists[filter].length > visible && <button type="button" onClick={()=>setVisible(v=>v+50)} style={more}>Afficher 50 dates supplémentaires</button>}
    <div style={meta}>Dernière actualisation de cette page : {now.toLocaleTimeString("fr-FR")}</div>
  </section>;
}
function Tab({active,onClick,children}:{active:boolean;onClick:()=>void;children:ReactNode}) {
  return <button type="button" onClick={onClick} style={{...tab,...(active?tabActive:{})}}>{children}</button>;
}
function StatusBadge({status}:{status:string}) {
  const v = status==="applied" ? ["En ligne","#dcfce7","#166534"] : ACTIVE.has(status) ? ["Mise en ligne…","#dbeafe","#1d4ed8"] : FAILED.has(status) ? ["À vérifier","#fee2e2","#b91c1c"] : status==="retry_pending" ? ["Nouvel essai prévu","#fef3c7","#92400e"] : ["En attente","#f1f5f9","#475569"];
  return <span style={{...statusBadge,background:v[1],color:v[2]}}>{v[0]}</span>;
}
function Stat({value,label,danger=false,good=false}:{value:number;label:string;danger?:boolean;good?:boolean}) {
  const background=danger?"#fef2f2":good?"#ecfdf5":"#eff6ff"; const color=danger?"#b91c1c":good?"#047857":"#1d4ed8";
  return <div style={{...stat,background}}><strong style={{fontSize:24,color}}>{value}</strong><span>{label}</span></div>;
}
const panel:CSSProperties={display:"grid",gap:16,border:"1px solid #bfdbfe",borderRadius:20,padding:20,marginBottom:20,background:"linear-gradient(135deg,#eff6ff,#fff)"};
const topLine:CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"};
const eyebrow:CSSProperties={fontSize:11,fontWeight:900,letterSpacing:".1em",color:"#2563eb"};
const description:CSSProperties={margin:0,color:"#475569",lineHeight:1.5,maxWidth:760};
const livePill:CSSProperties={background:"#dcfce7",color:"#166534",fontWeight:800,borderRadius:999,padding:"7px 11px",fontSize:13};
const stats:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:9};
const stat:CSSProperties={display:"grid",gap:1,padding:"10px 12px",borderRadius:13,fontSize:12,color:"#475569"};
const progressHead:CSSProperties={display:"flex",justifyContent:"space-between",gap:10,marginBottom:7,fontSize:13};
const progressTrack:CSSProperties={height:10,background:"#dbeafe",borderRadius:999,overflow:"hidden"};
const progressBar:CSSProperties={height:"100%",background:"linear-gradient(90deg,#2563eb,#14b8a6)",borderRadius:999};
const timingGrid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,padding:12,border:"1px solid #dbeafe",borderRadius:14,background:"#ffffffaa"};
const minorLabel:CSSProperties={display:"block",fontSize:11,color:"#64748b",marginBottom:4};
const error:CSSProperties={padding:"11px 13px",borderRadius:12,background:"#fef2f2",color:"#b91c1c"};
const tabs:CSSProperties={display:"flex",gap:8,flexWrap:"wrap",borderTop:"1px solid #dbeafe",paddingTop:14};
const tab:CSSProperties={border:"1px solid #cbd5e1",background:"white",borderRadius:999,padding:"8px 12px",font:"inherit",fontWeight:700,cursor:"pointer",color:"#475569"};
const tabActive:CSSProperties={background:"#0f172a",color:"white",borderColor:"#0f172a"};
const queue:CSSProperties={display:"grid",gap:7};
const queueRow:CSSProperties={display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",alignItems:"center",gap:12,padding:"10px 12px",background:"white",border:"1px solid #e2e8f0",borderRadius:12};
const queueReason:CSSProperties={display:"block",fontSize:11,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"};
const queuePrice:CSSProperties={fontWeight:800,textAlign:"right",whiteSpace:"nowrap"};
const statusBadge:CSSProperties={fontSize:11,fontWeight:800,borderRadius:999,padding:"6px 8px",whiteSpace:"nowrap"};
const more:CSSProperties={justifySelf:"center",border:"1px solid #bfdbfe",background:"white",color:"#1d4ed8",borderRadius:10,padding:"9px 14px",font:"inherit",fontWeight:700,cursor:"pointer"};
const empty:CSSProperties={padding:18,textAlign:"center",color:"#64748b",background:"#ffffff99",borderRadius:12};
const meta:CSSProperties={fontSize:11,color:"#64748b"};
