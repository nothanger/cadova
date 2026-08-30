import { supabase } from "@/lib/supabase"

export interface Notification {
  id: string
  company_id: string
  user_id: string
  type: "quote_followup_due" | "daily_followup_summary"
  title: string
  message: string
  related_quote_id: string | null
  notification_date: string
  read_at: string | null
  created_at: string
}

export async function listUnreadNotifications(
  userId: string,
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw error
}

export async function markOneRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function getEmailPreference(
  userId: string,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("company_members")
    .select("email_followup_reminders")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .single()
  if (error) throw error
  return data?.email_followup_reminders ?? true
}

export async function setEmailPreference(
  userId: string,
  companyId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("company_members")
    .update({ email_followup_reminders: enabled })
    .eq("user_id", userId)
    .eq("company_id", companyId)
  if (error) throw error
}

export interface ReminderPrefs {
  followupDelayDays: number
  reminderHour: number
}

export async function getReminderPrefs(
  userId: string,
  companyId: string,
): Promise<ReminderPrefs> {
  const { data, error } = await supabase
    .from("company_members")
    .select("followup_delay_days, reminder_hour")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .single()
  if (error) throw error
  return {
    followupDelayDays: data?.followup_delay_days ?? 3,
    reminderHour: data?.reminder_hour ?? 8,
  }
}

export async function setReminderPrefs(
  userId: string,
  companyId: string,
  prefs: Partial<ReminderPrefs>,
): Promise<void> {
  const update: Record<string, number> = {}
  if (prefs.followupDelayDays !== undefined)
    update.followup_delay_days = prefs.followupDelayDays
  if (prefs.reminderHour !== undefined)
    update.reminder_hour = prefs.reminderHour
  const { error } = await supabase
    .from("company_members")
    .update(update)
    .eq("user_id", userId)
    .eq("company_id", companyId)
  if (error) throw error
}
