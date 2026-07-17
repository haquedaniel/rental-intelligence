"use client";

import { useMemo, useState } from "react";

type Row = Record<string, any>;

type CalendarDate = {
  date: string;
  inMonth: boolean;
  row?: Row;
};

const eur = (value: any) => value == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
function isoDate(value: any) {
  return String(value || "").slice(0, 10);
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return value.toISOString().slice(0, 10);
}

function compare(a: string, b: string) {
  return a.localeCompare(b);
}

export default function ExplainablePricingCalendar({ rows, reservations = [] }: { rows: Row[]; reservations?: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [offset, setOffset] = useState(0);

  const months = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = isoDate(row.date).slice(0, 7);
      map.set(key, [...(map.get(key) || []), row]);
    }
    return [...map.entries()];
  }, [rows]);

  const current = months[Math.max(0, Math.min(offset, months.length - 1))];
  if (!current) return <p>Aucun calendrier calculé.</p>;

  const [monthKey, monthRows] = current;
  const first = new Date(`${monthKey}-01T12:00:00`);
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1);
  last.setDate(0);
  const monthStart = `${monthKey}-01`;
  const monthEndExclusive = addDays(last.toISOString().slice(0, 10), 1);
  const leading = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((leading + last.getDate()) / 7) * 7;
  const gridStart = addDays(monthStart, -leading);
  const rowByDate = new Map(monthRows.map((row) => [isoDate(row.date), row]));

  const dates: CalendarDate[] = Array.from({ length: totalCells }, (_, index) => {
    const date = addDays(gridStart, index);
    return { date, inMonth: date.slice(0, 7) === monthKey, row: rowByDate.get(date) };
  });
  const weeks = Array.from({ length: totalCells / 7 }, (_, index) => dates.slice(index * 7, index * 7 + 7));

  const overlappingReservations = reservations.filter((reservation) => {
    const start = isoDate(reservation.checkin_at || reservation.checkin_date || reservation.arrival);
    const end = isoDate(reservation.checkout_at || reservation.checkout_date || reservation.departure);
    return start && end && compare(start, monthEndExclusive) < 0 && compare(end, monthStart) > 0 && !["cancelled", "canceled"].includes(String(reservation.status || "").toLowerCase());
  });

  return <>
    <div className="calHead">
      <button type="button" onClick={() => setOffset(Math.max(0, offset - 1))}>←</button>
      <h3>{first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h3>
      <button type="button" onClick={() => setOffset(Math.min(months.length - 1, offset + 1))}>→</button>
    </div>
    <div className="weekLabels">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => <b key={label}>{label}</b>)}</div>
    <div className="monthGrid">
      {weeks.map((week, weekIndex) => {
        const weekStart = week[0].date;
        const weekEndExclusive = addDays(week[6].date, 1);
        const segments = overlappingReservations.flatMap((reservation) => {
          const stayStart = isoDate(reservation.checkin_at || reservation.checkin_date || reservation.arrival);
          const stayEnd = isoDate(reservation.checkout_at || reservation.checkout_date || reservation.departure);
          const segmentStart = compare(stayStart, weekStart) > 0 ? stayStart : weekStart;
          const segmentEnd = compare(stayEnd, weekEndExclusive) < 0 ? stayEnd : weekEndExclusive;
          if (compare(segmentStart, segmentEnd) >= 0) return [];
          const startDays = Math.round((new Date(`${segmentStart}T12:00:00`).getTime() - new Date(`${weekStart}T12:00:00`).getTime()) / 86400000);
          const endDays = Math.round((new Date(`${segmentEnd}T12:00:00`).getTime() - new Date(`${weekStart}T12:00:00`).getTime()) / 86400000);
          // Check-in and checkout are shown at midday. Continuations clipped by
          // the week boundary still run flush to that boundary.
          const startOffset = startDays + (segmentStart === stayStart ? 0.5 : 0);
          const endOffset = endDays + (segmentEnd === stayEnd ? 0.5 : 0);
          return [{ reservation, stayStart, stayEnd, segmentStart, segmentEnd, startOffset, endOffset }];
        });
        return <div className="calendarWeek" key={weekIndex}>
          <div className="reservationLayer">
            {segments.map((segment, index) => {
              const label = segment.reservation.guest_name || segment.reservation.guest_first_name || "Réservation";
              const startsHere = segment.segmentStart === segment.stayStart;
              const endsHere = segment.segmentEnd === segment.stayEnd;
              return <div
                className={`reservationBar ${startsHere ? "starts" : "continuesLeft"} ${endsHere ? "ends" : "continuesRight"}`}
                style={{
                  left: `${(segment.startOffset / 7) * 100}%`,
                  width: `${Math.max(3, ((segment.endOffset - segment.startOffset) / 7) * 100)}%`,
                }}
                title={`${label} · ${segment.stayStart} → ${segment.stayEnd}`}
                key={`${segment.reservation.id || label}-${index}`}
              ><span>●</span><strong>{label}</strong></div>;
            })}
          </div>
          <div className="daysGrid">
            {week.map(({ date, inMonth, row }) => {
              if (!inMonth || !row) return <div className="emptyDay" key={date} />;
              const active = (row.explanation_steps || []).filter((step: Row) => step.kind !== "base_plan");
              const reservation = overlappingReservations.find((item) => {
                const start = isoDate(item.checkin_at || item.checkin_date || item.arrival);
                const end = isoDate(item.checkout_at || item.checkout_date || item.departure);
                return compare(date, start) >= 0 && compare(date, end) < 0;
              });
              return <button type="button" key={date} className={`day ${row.occupied || reservation ? "occupied" : ""}`} onClick={() => setSelected({ ...row, reservation })}>
                <span className="date">{Number(date.slice(8))}</span>
                <strong>{eur(row.final_price)}</strong>
                {active.length > 0 ? (
                  <span className="whyPrice"><span>?</span> Pourquoi ce prix&nbsp;?</span>
                ) : null}
              </button>;
            })}
          </div>
        </div>;
      })}
    </div>

    {selected && <div className="shade" onClick={() => setSelected(null)}>
      <div className="drawer" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setSelected(null)}>×</button>
        <h2>{new Date(`${selected.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h2>
        {selected.reservation && <div className="reservationNote"><strong>{selected.reservation.guest_name || "Réservation"}</strong><span>{isoDate(selected.reservation.checkin_at)} → {isoDate(selected.reservation.checkout_at)}</span></div>}
        {selected.occupied && <div className="occupiedNote">Nuit déjà réservée · prix théorique uniquement</div>}
        <div className="final">Prix final <strong>{eur(selected.final_price)}</strong><span>{selected.min_stay} nuit(s)</span></div>
        {(selected.explanation_steps || []).map((step: Row, index: number) => <div className="step" key={index}>
          <div><b>{step.label}</b><p>{step.explanation}</p></div>
          <div className="numbers">{eur(step.before_eur)} → <strong>{eur(step.after_eur)}</strong>{step.delta_eur ? <small>{step.delta_eur > 0 ? "+" : ""}{eur(step.delta_eur)}</small> : null}</div>
        </div>)}
      </div>
    </div>}

    <style jsx>{`
      .calHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.calHead h3{margin:0;text-transform:capitalize}.calHead button{width:38px;height:38px;border:1px solid #cbd5e1;border-radius:10px;background:white}.weekLabels,.daysGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.weekLabels b{text-align:center;font-size:12px;padding:6px}.monthGrid{display:grid;gap:6px}.calendarWeek{position:relative;padding-top:34px}.reservationLayer{position:absolute;inset:0 0 auto 0;height:30px;pointer-events:none;z-index:3}.reservationBar{position:absolute;top:1px;min-width:0;height:27px;margin:1px 2px;background:linear-gradient(90deg,#172554,#1d4ed8);color:white;display:flex;align-items:center;gap:6px;padding:0 9px;box-shadow:0 3px 8px #1e3a8a33;font-size:11px;overflow:hidden}.reservationBar strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reservationBar span{font-size:7px;opacity:.8}.starts{border-radius:12px 3px 3px 12px}.ends{border-radius:3px 12px 12px 3px}.starts.ends{border-radius:12px}.continuesLeft{border-left:3px solid #93c5fd}.continuesRight{border-right:3px solid #93c5fd}.day,.emptyDay{min-height:92px}.day{position:relative;background:white;color:#0f172a;text-align:left;padding:8px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}.emptyDay{background:#fafafa;border-radius:10px}.date{color:#64748b}.day strong{display:block;margin-top:7px;font-size:18px}.whyPrice{display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:10px;font-weight:800;color:#477084}.whyPrice span{display:grid;width:16px;height:16px;place-items:center;border-radius:999px;background:#edf4f7;color:#112532;font-size:10px}.season{background:#ffedd5;color:#9a3412}.market{background:#dbeafe;color:#1d4ed8}.time{background:#dcfce7;color:#166534}.guard{background:#fef3c7;color:#92400e}.gap{background:#f3e8ff;color:#7e22ce}.manual{background:#fee2e2;color:#991b1b}.base{background:#f1f5f9;color:#475569}.occupied{background:#f8fafc}.shade{position:fixed;inset:0;background:#0f172a55;z-index:70}.drawer{position:absolute;right:0;top:0;height:100%;width:min(500px,96vw);background:white;padding:26px;box-shadow:-12px 0 30px #0002;overflow:auto}.close{float:right;border:0;background:#f1f5f9;border-radius:50%;width:36px;height:36px;font-size:24px}.occupiedNote,.reservationNote{padding:10px;border-radius:10px;color:#475569;margin:8px 0}.occupiedNote{background:#f1f5f9}.reservationNote{display:flex;justify-content:space-between;gap:10px;background:#eff6ff;color:#1e3a8a}.final{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px;background:#eff6ff;border-radius:12px;margin:16px 0}.final strong{font-size:24px}.step{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid #e2e8f0}.step p{margin:5px 0;color:#475569;font-size:13px}.numbers{text-align:right;white-space:nowrap}.numbers small{display:block;color:#64748b}
      @media(max-width:700px){.weekLabels,.daysGrid{gap:3px}.calendarWeek{padding-top:27px}.reservationLayer{height:24px}.reservationBar{height:22px;padding:0 5px;font-size:9px}.reservationBar span{display:none}.day,.emptyDay{min-height:70px}.day{padding:5px;border-radius:7px}.day strong{font-size:14px;margin-top:5px}.whyPrice{margin-top:5px;font-size:8px;gap:3px}.whyPrice span{width:14px;height:14px;font-size:8px}.drawer{top:auto;bottom:0;right:0;width:100%;height:min(82vh,720px);border-radius:20px 20px 0 0;padding:18px}.step{display:grid}.numbers{text-align:left}.final{padding:12px}.reservationNote{display:grid}}
    `}</style>
  </>;
}
