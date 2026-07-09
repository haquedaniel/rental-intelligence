// Patch for app/admin/owners/page.tsx
// Inside OwnerForm(), when !isNew and owner.public_token exists, show/copy the owner cockpit link.

{!isNew && owner.public_token && (
  <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
      Lien cockpit propriétaire
    </p>
    <Link
      href={`/owner/${owner.public_token}/cockpit`}
      className="mt-2 block break-all rounded-xl bg-white p-3 text-sm font-bold text-slate-950 ring-1 ring-slate-200"
    >
      /owner/{owner.public_token}/cockpit
    </Link>
  </div>
)}

Also update your owners query if needed to include public_token. Your current select("*") already includes it.
