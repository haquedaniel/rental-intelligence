"use client";

import { useActionState } from "react";
import {
  requestBriefingPreview,
  type PreviewState,
} from "@/app/owner/[ownerToken]/activity/actions";

const initialState: PreviewState = { status: "idle" };

export default function BriefingPreviewRequest({
  ownerToken,
}: {
  ownerToken: string;
}) {
  const [state, action, pending] = useActionState(
    requestBriefingPreview,
    initialState,
  );

  return (
    <form action={action} className="rounded-3xl bg-white p-5 shadow-sm">
      <input type="hidden" name="owner_token" value={ownerToken} />
      <input type="hidden" name="lookback_hours" value="24" />
      <h2 className="text-lg font-black">Tester le briefing</h2>
      <p className="mt-1 text-sm text-[#112532]/60">
        Génère une prévisualisation des dernières 24 heures sans envoyer de SMS
        et sans déplacer le prochain briefing programmé.
      </p>
      <button
        disabled={pending}
        className="mt-4 w-full rounded-2xl border border-[#112532]/15 bg-[#f7f4ee] px-4 py-3 font-black disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Demande en cours…" : "Générer une prévisualisation"}
      </button>
      {state.status !== "idle" && (
        <div
          className={[
            "mt-3 rounded-2xl px-4 py-3 text-sm",
            state.status === "queued"
              ? "bg-blue-50 text-blue-900"
              : "bg-red-50 text-red-800",
          ].join(" ")}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
