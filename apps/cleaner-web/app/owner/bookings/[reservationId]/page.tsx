import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RedirectToOwnerReservation({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  redirect("/owner/reservations/" + reservationId);
}
