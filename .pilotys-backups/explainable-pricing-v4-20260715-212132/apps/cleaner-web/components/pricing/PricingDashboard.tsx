import Link from "next/link";

type Row = Record<string, any>;
type FormAction = (formData: FormData) => void | Promise<void>;

const eur = (value: any) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(Number(value));

export type PricingDashboardProps = {
  title?: string;
  eyebrow?: string;
  description?: string;
  properties: Row[];
  propertyId?: string;
  settings?: Row | null;
  seasons: Row[];
  calendar: Row[];
  actions: Row[];
  basePath: string;
  backHref: string;
  backLabel: string;
  ownerToken?: string;
  savePricingSettings: FormAction;
  saveSeason: FormAction;
  deleteSeason: FormAction;
};

export default function PricingDashboard({
  title = "Tarification",
  eyebrow = "Pilotys · Revenue management",
  description = "Pilotys est la source de vérité. Beds24 ne sert qu’à publier.",
  properties,
  propertyId,
  settings,
  seasons,
  calendar,
  actions,
  basePath,
  backHref,
  backLabel,
  ownerToken,
  savePricingSettings,
  saveSeason,
  deleteSeason,
}: PricingDashboardProps) {
  const s: Row = settings || {};
  const scopeFields = ownerToken ? <input type="hidden" name="owner_token" value={ownerToken} /> : null;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 20px", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{eyebrow}</div>
          <h1 style={{ margin: "4px 0" }}>{title}</h1>
          <p style={{ margin: 0, color: "#475569" }}>{description}</p>
        </div>
        <Link href={backHref}>← {backLabel}</Link>
      </div>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "24px 0" }}>
        {properties.map((property: Row) => (
          <Link
            key={property.id}
            href={`${basePath}?property=${encodeURIComponent(property.id)}`}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              textDecoration: "none",
              background: property.id === propertyId ? "#0f172a" : "#e2e8f0",
              color: property.id === propertyId ? "white" : "#0f172a",
            }}
          >
            {property.name}
          </Link>
        ))}
      </nav>

      {properties.length === 0 && (
        <section style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
          <p style={{ margin: 0 }}>Aucun logement actif n’est lié à ce propriétaire.</p>
        </section>
      )}

      {propertyId && (
        <>
          <section style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <h2>Stratégie générale</h2>
            <form action={savePricingSettings} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              {scopeFields}
              <input type="hidden" name="property_id" value={propertyId} />
              <label>Prix semaine<input name="default_price" type="number" step="0.01" defaultValue={s.default_price ?? 100} /></label>
              <label>Prix ven./sam.<input name="default_weekend_price" type="number" step="0.01" defaultValue={s.default_weekend_price ?? ""} /></label>
              <label>Plancher<input name="floor_price" type="number" step="0.01" defaultValue={s.floor_price ?? 50} /></label>
              <label>Plafond<input name="ceiling_price" type="number" step="0.01" defaultValue={s.ceiling_price ?? ""} /></label>
              <label>Séjour minimum<input name="default_min_stay" type="number" min="1" defaultValue={s.default_min_stay ?? 2} /></label>
              <label>Baisse hebdomadaire<input name="weekly_decay_amount" type="number" step="0.01" min="0" defaultValue={s.weekly_decay_amount ?? 2} /></label>
              <label>Nombre max. de baisses<input name="weekly_decay_max_steps" type="number" min="0" defaultValue={s.weekly_decay_max_steps ?? 5} /></label>
              <label>Début de baisse à J-<input name="decay_starts_days_before_arrival" type="number" min="0" defaultValue={s.decay_starts_days_before_arrival ?? 120} /></label>
              <label>Prime nuit isolée<input name="one_night_gap_multiplier" type="number" step="0.05" min="1" defaultValue={s.one_night_gap_multiplier ?? 1.5} /></label>
              <label>Libérer 1 nuit à J-<input name="one_night_release_days" type="number" min="0" defaultValue={s.one_night_release_days ?? 21} /></label>
              <label>Horizon (jours)<input name="planning_horizon_days" type="number" min="30" defaultValue={s.planning_horizon_days ?? 540} /></label>
              <label>Mode<select name="mode" defaultValue={s.mode ?? "shadow"}><option value="shadow">Simulation</option><option value="apply">Publication</option></select></label>
              <label><input name="protect_weekends" type="checkbox" defaultChecked={s.protect_weekends ?? true} /> Protéger les week-ends</label>
              <label><input name="enabled" type="checkbox" defaultChecked={s.enabled ?? false} /> Moteur actif</label>
              <button type="submit">Enregistrer</button>
            </form>
          </section>

          <section style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <h2>Saisons et pics connus</h2>
            <form action={saveSeason} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
              {scopeFields}
              <input type="hidden" name="property_id" value={propertyId} />
              <input name="name" placeholder="Été / Noël…" required />
              <input name="start_date" type="date" required />
              <input name="end_date" type="date" required />
              <input name="weekday_price" type="number" step=".01" placeholder="Semaine" required />
              <input name="weekend_price" type="number" step=".01" placeholder="Week-end" />
              <input name="floor_price" type="number" step=".01" placeholder="Plancher" />
              <input name="ceiling_price" type="number" step=".01" placeholder="Plafond" />
              <input name="min_stay" type="number" min="1" defaultValue="2" />
              <input name="priority" type="number" defaultValue="100" />
              <button>Ajouter</button>
            </form>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th>Saison</th><th>Période</th><th>Semaine</th><th>Week-end</th><th>Min.</th><th /></tr></thead>
                <tbody>
                  {seasons.map((season: Row) => (
                    <tr key={season.id}>
                      <td>{season.name}</td><td>{season.start_date} → {season.end_date}</td><td>{eur(season.weekday_price)}</td><td>{eur(season.weekend_price)}</td><td>{season.min_stay} nuits</td>
                      <td><form action={deleteSeason}>{scopeFields}<input type="hidden" name="property_id" value={propertyId} /><input type="hidden" name="id" value={season.id} /><button>Retirer</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <h2>Calendrier calculé · 90 jours</h2>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th>Date</th><th>État</th><th>Plan</th><th>Ajustement</th><th>Prix final</th><th>Min.</th><th>Stratégie</th><th>Publication</th></tr></thead><tbody>{calendar.map((row: Row) => <tr key={row.date} style={{ opacity: row.occupied ? 0.6 : 1 }}><td>{row.date}</td><td>{row.occupied ? "Occupé" : "Libre"}</td><td>{eur(row.base_price)}</td><td>{eur(row.strategy_adjustment)}</td><td><strong>{eur(row.final_price)}</strong></td><td>{row.min_stay}</td><td>{row.strategy}</td><td>{row.publication_status}</td></tr>)}</tbody></table></div>
          </section>

          <section style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
            <h2>Dernières décisions</h2>
            {actions.length === 0 ? <p>Aucune décision générée.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%" }}><thead><tr><th>Date</th><th>Ancien</th><th>Cible</th><th>Min.</th><th>Motif</th><th>État</th></tr></thead><tbody>{actions.map((row: Row) => <tr key={row.id}><td>{row.date}</td><td>{eur(row.old_price)}</td><td>{eur(row.target_price)}</td><td>{row.target_min_stay}</td><td>{row.reason}</td><td>{row.status}</td></tr>)}</tbody></table></div>}
          </section>
        </>
      )}
      <style>{`label{display:flex;flex-direction:column;gap:5px;font-size:13px;color:#475569}input,select,button{font:inherit;padding:9px;border:1px solid #cbd5e1;border-radius:8px}button{cursor:pointer;background:#0f172a;color:white}th,td{text-align:left;padding:9px;border-bottom:1px solid #e2e8f0;font-size:13px}`}</style>
    </main>
  );
}
