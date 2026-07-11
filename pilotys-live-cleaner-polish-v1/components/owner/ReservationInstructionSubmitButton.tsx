"use client";

import { useFormStatus } from "react-dom";

export default function ReservationInstructionSubmitButton({
  locked = false,
}: {
  locked?: boolean;
}) {
  const { pending } = useFormStatus();

  if (locked) {
    return (
      <button
        type="button"
        disabled
        className="mt-3 rounded-full bg-[#112532]/20 px-5 py-3 text-sm font-black text-[#112532]/45"
      >
        Notes locked after mission completion
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 rounded-full bg-[#E0680E] px-5 py-3 text-sm font-black text-white shadow-sm shadow-[#E0680E]/20 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Saving notes…" : "Save important notes"}
    </button>
  );
}
