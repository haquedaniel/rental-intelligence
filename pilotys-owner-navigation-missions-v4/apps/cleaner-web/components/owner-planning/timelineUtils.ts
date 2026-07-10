/*
 * This file is intentionally a small patch snippet for the installer.
 * It is not copied over the live file directly.
 *
 * The installer updates these functions in the live owner-planning/timelineUtils.ts:
 *
 * export function requestIssueHref(request: Row): string {
 *   return `/owner/missions/${request.id}`;
 * }
 *
 * export function reservationHref(reservation: Row): string {
 *   return `/owner/reservations/${reservation.id}`;
 * }
 */
