"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

type Row = Record<string, any>;

const PENDING = new Set(["pending", "queued", "proposed", "retry_pending"]);
const ACTIVE = new Set(["applying", "sending"]);
const FAILED = new Set(["failed", "validation_failed"]);

function euro(value: any) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function nextTenMinuteDelay(now: Date) {
  const minute = now.getMinutes();
  const remainingMinutes = 10 - (minute % 10 || 10);
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(minute + (minute % 10 === 0 ? 10 : 10 - (minute % 10)));
  return Math.max(0, next.getTime() - now.getTime());
}

function humanDelay(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${String(seconds).padStart(2, "0")} s` : `${seconds} s`;
}

export default function PublicationStatusPanel({
  settings,
  actions,
  calendar,
}: {
  settings: Row | null;
  actions: Row[];
  calendar: Row[];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const settingsRow = settings || {};
  const live = settingsRow.mode === "apply";
  const paused = Boolean(settingsRow.publication_paused);

  const counts = useMemo(() => {
    const publishable = calendar.filter((row) => row.available !== false && !row.occupied);
    const published = publishable.filter((row) => row.publication_status === "published").length;
    const failed = publishable.filter((row) => row.publication_status === "failed").length;
    const active = publishable.filter((row) => ACTIVE.has(String(row.publication_status || ""))).length;
    const pending = publishable.filter((row) => {
      const status = String(row.publication_status || "pending");
      return !["published", "not_required", "failed"].includes(status);
    }).length;
    return { total: publishable.length, published, pending, active, failed };
  }, [calendar]);

  const recentQueue = useMemo(
    () =>
      actions
        .filter((row) => {
          const status = String(row.status || "");
          return PENDING.has(status) || ACTIVE.has(status) || FAILED.has(status);
        })
        .slice(0, 12),
    [actions],
  );

  const lastRunActions = useMemo(() => {
    if (!settingsRow.publication_last_run_at) return [];
    const lastRun = new Date(settingsRow.publication_last_run_at).getTime();
    return actions.filter((row) => {
      const attempted = row.last_attempt_at || row.applied_at || row.updated_at;
      if (!attempted) return false;
      return Math.abs(new Date(attempted).getTime() - lastRun) < 5 * 60 * 1000;
    });
  }, [actions, settingsRow.publication_last_run_at]);

  const lastApplied = lastRunActions.filter((row) => row.status === "applied").length;
  const lastFailed = lastRunActions.filter((row) => FAILED.has(String(row.status || ""))).length;
  const progress = counts.total > 0 ? Math.round((counts.published / counts.total) * 100) : 100;
  const hasWork = live && !paused && (counts.pending > 0 || counts.active > 0);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!hasWork) return;
    const refresh = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(refresh);
  }, [hasWork, router]);

  const estimatedMinutes = counts.pending > 0 ? Math.ceil(counts.pending / 30) * 10 : 0;

  return (
    <section style={panel}>
      <div style={topLine}>
        <div>
          <div style={eyebrow}>MISE EN LIGNE DES PRIX</div>
          <h2 style={{ margin: "4px 0 6px" }}>
            {!live ? "Aperçu Pilotys" : paused ? "Mise en ligne suspendue" : counts.pending || counts.active ? "Mise en ligne en cours" : "Tous les prix sont en ligne"}
          </h2>
          <p style={description}>
            {!live
              ? "Le calendrier est calculé, mais aucun changement n’est visible par les voyageurs."
              : paused
                ? "Pilotys continue de calculer les prix. Les changements attendent la reprise de la diffusion."
                : counts.pending || counts.active
                  ? "Les changements sont transmis automatiquement par lots. Cette page s’actualise pendant la progression."
                  : "Le calendrier Pilotys et les prix visibles par les voyageurs sont synchronisés."}
          </p>
        </div>
        {live && !paused && <span style={livePill}>{counts.pending || counts.active ? "Synchronisation active" : "À jour"}</span>}
      </div>

      <div style={stats}>
        <Stat value={counts.pending} label="à publier" />
        <Stat value={counts.active} label="en cours" />
        <Stat value={counts.published} label="en ligne" good />
        <Stat value={counts.failed} label="à vérifier" danger={counts.failed > 0} />
      </div>

      {live && counts.total > 0 && (
        <div>
          <div style={progressHead}>
            <strong>{counts.published} / {counts.total} dates en ligne</strong>
            <span>{progress}%</span>
          </div>
          <div style={progressTrack}><div style={{ ...progressBar, width: `${progress}%` }} /></div>
        </div>
      )}

      {live && !paused && (counts.pending > 0 || counts.active > 0) && (
        <div style={timingGrid}>
          <div><span style={minorLabel}>Prochain passage automatique</span><strong>dans {humanDelay(nextTenMinuteDelay(now))}</strong></div>
          <div><span style={minorLabel}>Temps restant estimé</span><strong>environ {estimatedMinutes} min</strong></div>
          <div><span style={minorLabel}>Dernier passage</span><strong>{settingsRow.publication_last_run_at ? new Date(settingsRow.publication_last_run_at).toLocaleString("fr-FR") : "pas encore exécuté"}</strong></div>
          <div><span style={minorLabel}>Résultat du dernier passage</span><strong>{lastApplied} accepté{lastApplied > 1 ? "s" : ""}{lastFailed ? ` · ${lastFailed} erreur${lastFailed > 1 ? "s" : ""}` : ""}</strong></div>
        </div>
      )}

      {settingsRow.publication_last_error && <div style={error}>{settingsRow.publication_last_error}</div>}

      {recentQueue.length > 0 && (
        <details style={details}>
          <summary style={summary}>Voir le détail de la mise en ligne ({recentQueue.length})</summary>
          <div style={queue}>
            {recentQueue.map((row) => {
              const status = String(row.status || "");
              return (
                <div key={row.id || `${row.date}-${status}`} style={queueRow}>
                  <div><strong>{dateLabel(row.date)}</strong><span style={queueReason}>{row.reason || row.reason_code || "Mise à jour du prix"}</span></div>
                  <div style={queuePrice}>{euro(row.target_price ?? row.target_price_eur)}<small>{row.target_min_stay ?? row.target_min_stay_eur ?? row.target_minimum_stay ?? row.target_min_stay ? `${row.target_min_stay} nuit(s)` : ""}</small></div>
                  <StatusBadge status={status} />
                </div>
              );
            })}
          </div>
        </details>
      )}

      <div style={meta}>Dernière actualisation de cette page : {now.toLocaleTimeString("fr-FR")}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const value = ACTIVE.has(status)
    ? ["Mise en ligne…", "#dbeafe", "#1d4ed8"]
    : FAILED.has(status)
      ? ["À vérifier", "#fee2e2", "#b91c1c"]
      : status === "retry_pending"
        ? ["Nouvel essai prévu", "#fef3c7", "#92400e"]
        : ["En attente", "#f1f5f9", "#475569"];
  return <span style={{ ...statusBadge, background: value[1], color: value[2] }}>{value[0]}</span>;
}

function Stat({ value, label, danger = false, good = false }: { value: number; label: string; danger?: boolean; good?: boolean }) {
  const background = danger ? "#fef2f2" : good ? "#ecfdf5" : "#eff6ff";
  const color = danger ? "#b91c1c" : good ? "#047857" : "#1d4ed8";
  return <div style={{ ...stat, background }}><strong style={{ fontSize: 24, color }}>{value}</strong><span>{label}</span></div>;
}

const panel: CSSProperties = { display: "grid", gap: 16, border: "1px solid #bfdbfe", borderRadius: 20, padding: 20, marginBottom: 20, background: "linear-gradient(135deg,#eff6ff,#fff)" };
const topLine: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" };
const eyebrow: CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: ".1em", color: "#2563eb" };
const description: CSSProperties = { margin: 0, color: "#475569", lineHeight: 1.5, maxWidth: 760 };
const livePill: CSSProperties = { background: "#dcfce7", color: "#166534", fontWeight: 800, borderRadius: 999, padding: "7px 11px", fontSize: 13 };
const stats: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,130px))", gap: 9 };
const stat: CSSProperties = { display: "grid", gap: 1, padding: "10px 12px", borderRadius: 13, fontSize: 12, color: "#475569" };
const progressHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 7, fontSize: 13 };
const progressTrack: CSSProperties = { height: 10, background: "#dbeafe", borderRadius: 999, overflow: "hidden" };
const progressBar: CSSProperties = { height: "100%", background: "linear-gradient(90deg,#2563eb,#14b8a6)", borderRadius: 999, transition: "width .35s ease" };
const timingGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, padding: 13, borderRadius: 13, background: "#ffffffaa", border: "1px solid #dbeafe" };
const minorLabel: CSSProperties = { display: "block", color: "#64748b", fontSize: 11, marginBottom: 3 };
const error: CSSProperties = { padding: 11, borderRadius: 11, background: "#fef2f2", color: "#991b1b" };
const details: CSSProperties = { borderTop: "1px solid #dbeafe", paddingTop: 12 };
const summary: CSSProperties = { cursor: "pointer", fontWeight: 800, color: "#1e3a8a" };
const queue: CSSProperties = { display: "grid", gap: 7, marginTop: 10 };
const queueRow: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", alignItems: "center", gap: 12, padding: "9px 10px", background: "white", border: "1px solid #e2e8f0", borderRadius: 11 };
const queueReason: CSSProperties = { display: "block", color: "#64748b", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const queuePrice: CSSProperties = { textAlign: "right", fontWeight: 800 };
const statusBadge: CSSProperties = { fontSize: 11, fontWeight: 800, padding: "5px 8px", borderRadius: 999, whiteSpace: "nowrap" };
const meta: CSSProperties = { fontSize: 11, color: "#64748b" };
