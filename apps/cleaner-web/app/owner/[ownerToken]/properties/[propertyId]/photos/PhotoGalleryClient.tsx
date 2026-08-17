"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteListingPhoto,
  saveListingPhotoOrder,
  updateListingPhoto,
} from "./actions";

export type ListingPhoto = {
  id: string;
  caption: string;
  category: string;
  publicUrl: string;
  airbnb_enabled: boolean;
  vrbo_enabled: boolean;
  booking_enabled: boolean;
  direct_enabled: boolean;
  sync_status: string;
  sync_error: string | null;
};

const CATEGORY_OPTIONS = [
  ["living_room", "Salon"],
  ["bedroom", "Chambre"],
  ["kitchen", "Cuisine"],
  ["bathroom", "Salle de bain"],
  ["dining", "Salle à manger"],
  ["outdoor", "Extérieur"],
  ["view", "Vue"],
  ["other", "Autre"],
] as const;

function move<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function PhotoGalleryClient({
  ownerToken,
  propertyId,
  initialPhotos,
}: {
  ownerToken: string;
  propertyId: string;
  initialPhotos: ListingPhoto[];
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function persistOrder(next: ListingPhoto[]) {
    setPhotos(next);
    startTransition(async () => {
      await saveListingPhotoOrder(
        ownerToken,
        propertyId,
        next.map((photo) => photo.id),
      );
      router.refresh();
    });
  }

  function movePhoto(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    persistOrder(move(photos, index, target));
  }

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const from = photos.findIndex((photo) => photo.id === draggedId);
    const to = photos.findIndex((photo) => photo.id === targetId);
    if (from < 0 || to < 0) return;
    persistOrder(move(photos, from, to));
    setDraggedId(null);
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-[#112532]/20 bg-white/60 p-10 text-center text-sm font-semibold text-[#112532]/55">
        Aucune photo pour l’instant. Ajoutez votre galerie ci-dessus.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {photos.map((photo, index) => {
        const updateAction = updateListingPhoto.bind(
          null,
          ownerToken,
          propertyId,
          photo.id,
        );
        const deleteAction = deleteListingPhoto.bind(
          null,
          ownerToken,
          propertyId,
          photo.id,
        );

        return (
          <article
            key={photo.id}
            draggable
            onDragStart={() => setDraggedId(photo.id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropOn(photo.id)}
            className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-[#112532]/8"
          >
            <div className="relative aspect-[4/3] bg-[#E8EEF0]">
              <img
                src={photo.publicUrl}
                alt={photo.caption || `Photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute left-3 top-3 flex gap-2">
                {index === 0 && (
                  <span className="rounded-full bg-[#E0680E] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-sm">
                    Photo principale
                  </span>
                )}
                <span className="cursor-grab rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-[#112532] shadow-sm">
                  ↕ {index + 1}
                </span>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold text-[#112532]/48">
                  Glisser pour réordonner
                </div>
                <div className="flex gap-1 sm:hidden">
                  <button
                    type="button"
                    onClick={() => movePhoto(index, -1)}
                    disabled={index === 0 || isPending}
                    className="grid h-8 w-8 place-items-center rounded-full bg-[#F1F5F6] font-black text-[#112532] disabled:opacity-30"
                    aria-label="Déplacer avant"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(index, 1)}
                    disabled={index === photos.length - 1 || isPending}
                    className="grid h-8 w-8 place-items-center rounded-full bg-[#F1F5F6] font-black text-[#112532] disabled:opacity-30"
                    aria-label="Déplacer après"
                  >
                    →
                  </button>
                </div>
              </div>

              <form action={updateAction} className="space-y-3">
                <div>
                  <label className="text-xs font-black text-[#112532]/65">Légende</label>
                  <input
                    name="caption"
                    defaultValue={photo.caption}
                    placeholder="Ex. Salon avec vue sur la mer"
                    className="mt-1.5 w-full rounded-xl border border-[#112532]/12 bg-[#FAFBFB] px-3 py-2.5 text-sm text-[#112532] outline-none focus:border-[#E0680E]/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-[#112532]/65">Type</label>
                  <select
                    name="category"
                    defaultValue={photo.category || "other"}
                    className="mt-1.5 w-full rounded-xl border border-[#112532]/12 bg-[#FAFBFB] px-3 py-2.5 text-sm text-[#112532]"
                  >
                    {CATEGORY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <details className="rounded-xl bg-[#F5F7F7] p-3">
                  <summary className="cursor-pointer text-xs font-black text-[#112532]/65">
                    Diffusion avancée
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-[#112532]/70">
                    {[
                      ["airbnb_enabled", "Airbnb", photo.airbnb_enabled],
                      ["booking_enabled", "Booking.com", photo.booking_enabled],
                      ["vrbo_enabled", "Vrbo", photo.vrbo_enabled],
                      ["direct_enabled", "Direct", photo.direct_enabled],
                    ].map(([name, label, checked]) => (
                      <label key={String(name)} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name={String(name)}
                          defaultChecked={Boolean(checked)}
                        />
                        {String(label)}
                      </label>
                    ))}
                  </div>
                </details>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#112532] px-4 py-2.5 text-sm font-black text-white"
                >
                  Enregistrer
                </button>
              </form>

              <form action={deleteAction}>
                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                >
                  Supprimer la photo
                </button>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}
