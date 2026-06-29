"use client";

import { useMemo, useState } from "react";

export type InterventionSlotOption = {
  value: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
  occupied?: boolean;
};

export function InterventionSlotPicker({
  slots,
  inputName = "selected_start_at",
  defaultValue,
}: {
  slots: InterventionSlotOption[];
  inputName?: string;
  defaultValue?: string | null;
}) {
  const initialSlot =
    (defaultValue
      ? slots.find(
          (slot) =>
            new Date(slot.value).getTime() === new Date(defaultValue).getTime(),
        )
      : null) ?? slots[0];

  const [dateKey, setDateKey] = useState(initialSlot?.dateKey ?? "");
  const [selectedValue, setSelectedValue] = useState(initialSlot?.value ?? "");

  const dates = useMemo(() => {
    const seen = new Set<string>();

    return slots
      .filter((slot) => {
        if (seen.has(slot.dateKey)) return false;
        seen.add(slot.dateKey);
        return true;
      })
      .map((slot) => ({
        key: slot.dateKey,
        label: slot.dateLabel,
      }));
  }, [slots]);

  const slotsForDate = useMemo(
    () => slots.filter((slot) => slot.dateKey === dateKey),
    [slots, dateKey],
  );

  const selectedSlot =
    slots.find((slot) => slot.value === selectedValue) ??
    slotsForDate[0] ??
    null;

  function handleDateChange(nextDateKey: string) {
    setDateKey(nextDateKey);

    const firstSlotForDate = slots.find((slot) => slot.dateKey === nextDateKey);
    setSelectedValue(firstSlotForDate?.value ?? "");
  }

  if (slots.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name={inputName} value={selectedSlot?.value ?? ""} />

      <label className="block">
        <span className="text-sm font-bold text-slate-800">Date</span>
        <select
          value={dateKey}
          onChange={(event) => handleDateChange(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white p-4 text-base font-bold text-slate-950"
        >
          {dates.map((date) => (
            <option key={date.key} value={date.key}>
              {date.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-bold text-slate-800">Heure</span>
        <select
          value={selectedSlot?.value ?? ""}
          onChange={(event) => setSelectedValue(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white p-4 text-base font-bold text-slate-950"
        >
          {slotsForDate.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.timeLabel}
              {slot.occupied ? " · logement occupé" : ""}
            </option>
          ))}
        </select>
      </label>

      {selectedSlot?.occupied && (
        <p className="sm:col-span-2 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-950 ring-1 ring-amber-100">
          ⚠ Ce créneau tombe pendant une occupation voyageur, mais le propriétaire l’a autorisé.
        </p>
      )}
    </div>
  );
}
