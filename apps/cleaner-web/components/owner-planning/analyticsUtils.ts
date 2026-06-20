import {
  compactDateLabel,
  parisDateKey,
  type Row,
} from "./timelineUtils";

export function numberValue(row: Row, fields: string[]): number {
  for (const field of fields) {
    const raw = row?.[field];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export function money(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function reservationRevenue(row: Row): number {
  return numberValue(row, [
    "accommodation_revenue_eur",
    "accommodation_revenue",
    "host_payout_eur",
    "host_payout",
    "revenue_eur",
    "total_revenue_eur",
    "amount_eur",
    "total_eur",
    "price_eur",
    "total_price",
  ]);
}

export function cleaningCost(row: Row): number {
  return numberValue(row, [
    "total_cost_eur",
    "cleaning_cost_eur",
    "amount_eur",
  ]);
}

export function monthKeyFromIso(iso?: string | null): string {
  if (!iso) return "Sans date";
  return parisDateKey(iso).slice(0, 7);
}

export function monthLabel(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const date = new Date(`${monthKey}-15T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
  }).format(date).replace(".", "");
}

export function inDateRangeByStay(row: Row, start: string, end: string): boolean {
  if (!row.checkin_at || !row.checkout_at) return false;
  const checkin = parisDateKey(row.checkin_at);
  const checkout = parisDateKey(row.checkout_at);
  return checkin <= end && checkout >= start;
}

export function inDateRangeByScheduled(row: Row, start: string, end: string): boolean {
  if (!row.scheduled_start_at) return false;
  const date = parisDateKey(row.scheduled_start_at);
  return date >= start && date <= end;
}

export function groupRevenueByPropertyAndMonth({
  reservations,
  propertiesById,
}: {
  reservations: Row[];
  propertiesById: Record<string, Row>;
}) {
  const map = new Map<string, {
    propertyId: string;
    propertyName: string;
    month: string;
    revenue: number;
    reservations: number;
  }>();

  for (const reservation of reservations) {
    const propertyId = String(reservation.property_id ?? "");
    const month = monthKeyFromIso(reservation.checkin_at);
    const key = `${propertyId}:${month}`;

    const current = map.get(key) ?? {
      propertyId,
      propertyName: propertiesById[propertyId]?.name ?? "Logement",
      month,
      revenue: 0,
      reservations: 0,
    };

    current.revenue += reservationRevenue(reservation);
    current.reservations += 1;
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.propertyName}-${a.month}`.localeCompare(`${b.propertyName}-${b.month}`),
  );
}

export function groupCostsByType({
  requests,
}: {
  requests: Row[];
}) {
  const map = new Map<string, {
    label: string;
    amount: number;
    count: number;
  }>();

  for (const request of requests) {
    const key = request.service_type || "standard_cleaning";
    const label =
      key === "garden_lawn"
        ? "Jardin"
        : key === "deep_cleaning"
          ? "Grand ménage"
          : key === "linen_laundry"
            ? "Linge"
            : "Ménage";

    const current = map.get(key) ?? { label, amount: 0, count: 0 };
    current.amount += cleaningCost(request);
    current.count += 1;
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

export function periodLabel(start: string, end: string): string {
  return `${compactDateLabel(start)} → ${compactDateLabel(end)}`;
}
