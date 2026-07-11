type JsonObject = Record<string, any>;

type OperationalEventInput = {
  eventType: string;
  severity?: "debug" | "info" | "warning" | "error" | "critical";
  source?: string;

  actorType?: string | null;
  actorId?: string | null;

  propertyId?: string | null;
  reservationId?: string | null;
  cleaningRequestId?: string | null;
  cleanerId?: string | null;
  ownerId?: string | null;
  cleaningProfileId?: string | null;

  statusBefore?: string | null;
  statusAfter?: string | null;

  reasonCode?: string | null;
  reason?: string | null;

  title?: string | null;
  summary?: string | null;
  eventKey?: string | null;

  oldData?: JsonObject | null;
  newData?: JsonObject | null;
  context?: JsonObject | null;
};

function cleanPayload(payload: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export async function logOperationalEvent(
  supabase: any,
  event: OperationalEventInput,
): Promise<boolean> {
  try {
    const payload = cleanPayload({
      event_type: event.eventType,
      severity: event.severity ?? "info",
      source: event.source ?? "app",

      actor_type: event.actorType ?? null,
      actor_id: event.actorId ?? null,

      property_id: event.propertyId ?? null,
      reservation_id: event.reservationId ?? null,
      cleaning_request_id: event.cleaningRequestId ?? null,
      cleaner_id: event.cleanerId ?? null,
      owner_id: event.ownerId ?? null,
      cleaning_profile_id: event.cleaningProfileId ?? null,

      status_before: event.statusBefore ?? null,
      status_after: event.statusAfter ?? null,

      reason_code: event.reasonCode ?? null,
      reason: event.reason ?? null,

      title: event.title ?? null,
      summary: event.summary ?? null,
      event_key: event.eventKey ?? null,

      old_data: event.oldData ?? null,
      new_data: event.newData ?? null,
      context: event.context ?? null,
    });

    const { error } = await supabase.from("operational_event_log").insert(payload);

    if (error) {
      console.warn("operational_event_log insert failed", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("operational_event_log unexpected failure", error);
    return false;
  }
}

export async function logCleaningRequestEvent(
  supabase: any,
  requestId: string,
  event: Omit<
    OperationalEventInput,
    | "propertyId"
    | "reservationId"
    | "cleaningRequestId"
    | "cleanerId"
    | "cleaningProfileId"
    | "newData"
  > & {
    newData?: JsonObject | null;
  },
): Promise<boolean> {
  try {
    const { data: request } = await supabase
      .from("cleaning_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    return logOperationalEvent(supabase, {
      ...event,
      propertyId: request?.property_id ?? null,
      reservationId: request?.reservation_id ?? null,
      cleaningRequestId: requestId,
      cleanerId: request?.assigned_cleaner_id ?? null,
      cleaningProfileId: request?.cleaning_profile_id ?? null,
      statusAfter: event.statusAfter ?? request?.status ?? null,
      newData: event.newData ?? request ?? null,
      context: {
        ...(event.context ?? {}),
        mission_type: request?.mission_type ?? "cleaning",
        schedule_status: request?.schedule_status ?? null,
        ready_by_at: request?.ready_by_at ?? null,
        scheduled_start_at: request?.scheduled_start_at ?? null,
        scheduled_end_at: request?.scheduled_end_at ?? null,
      },
    });
  } catch (error) {
    console.warn("logCleaningRequestEvent failed", error);
    return false;
  }
}
