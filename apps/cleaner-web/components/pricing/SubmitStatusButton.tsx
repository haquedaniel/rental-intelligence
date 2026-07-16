"use client";
import { useFormStatus } from "react-dom";

export default function SubmitStatusButton({idle="Enregistrer et recalculer",pending="Recalcul en cours…"}:{idle?:string;pending?:string}) {
  const { pending: isPending } = useFormStatus();
  return <button type="submit" disabled={isPending} aria-busy={isPending} style={{
    border:0,borderRadius:10,padding:"11px 16px",fontWeight:700,cursor:isPending?"wait":"pointer",
    background:isPending?"#94a3b8":"#0f172a",color:"white",display:"inline-flex",gap:8,alignItems:"center"
  }}>
    {isPending && <span aria-hidden style={{display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,.45)",borderTopColor:"white",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>}
    {isPending?pending:idle}
  </button>;
}
