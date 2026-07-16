import type { CSSProperties, ReactNode } from "react";

type Row = Record<string, any>;

const panelStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 20,
  marginBottom: 20,
};

const versionStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: "10px 0",
  borderBottom: "1px solid #e2e8f0",
};

export default function PricingVersionPanel({
  versions,
  rollbackAction,
  hiddenFields,
}: {
  versions: Row[];
  rollbackAction: (fd: FormData) => void;
  hiddenFields: ReactNode;
}) {
  const active = versions.find((version) => version.status === "active");

  return (
    <section style={panelStyle}>
      <h2>Versions Pilotys</h2>

      {active ? (
        <p>
          <b>Version {active.version_number}</b> appliquée dans Pilotys le{" "}
          {new Date(active.created_at).toLocaleString("fr-FR")}. Rien n’est
          publié dans Beds24 en mode Simulation.
        </p>
      ) : (
        <p>Aucune version enregistrée.</p>
      )}

      <details>
        <summary>Historique et rollback</summary>
        {versions.map((version) => (
          <div style={versionStyle} key={version.id}>
            <span>
              v{version.version_number} ·{" "}
              {new Date(version.created_at).toLocaleString("fr-FR")}
              {version.change_summary ? ` · ${version.change_summary}` : ""}
            </span>

            {version.status !== "active" && (
              <form action={rollbackAction}>
                {hiddenFields}
                <input
                  type="hidden"
                  name="target_version_id"
                  value={version.id}
                />
                <button type="submit">
                  Rollback vers v{version.version_number}
                </button>
              </form>
            )}
          </div>
        ))}
      </details>
    </section>
  );
}
