/** Error codes/messages that mean "the Cadova schema isn't there yet". */
export function isSchemaMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { code?: string; message?: string }
  return (
    e.code === "PGRST205" || // table not in PostgREST schema cache
    e.code === "PGRST204" || // requested column not in PostgREST schema cache
    e.code === "42P01" || // undefined_table
    /schema cache|does not exist/i.test(e.message ?? "")
  )
}

/** True when notifications migration 0002 has not been applied yet. */
export function isNotificationsMigrationMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { code?: string; message?: string }
  const schemaMissing =
    e.code === "PGRST204" || // column missing in write payload (schema cache)
    e.code === "42703" || // undefined_column (read path)
    e.code === "PGRST205" || // table missing in schema cache
    e.code === "42P01" // undefined_table
  return (
    schemaMissing &&
    /email_followup_reminders|notifications/i.test(e.message ?? "")
  )
}
