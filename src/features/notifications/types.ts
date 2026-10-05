export type NotificationType =
  | "quote_followup_due"
  | "daily_followup_summary"
  | "support_message"
  | "admin_message"
  | "admin_announcement"
  | "quote_followup_sent"
  | "quote_followup_failed"
  | "quote_sent"
  | "quote_send_failed"
  | "quote_client_message"
  | "quote_email_delivery"
  | "quote_email_response"

export interface Notification {
  id: string
  company_id: string | null
  user_id: string
  type: NotificationType
  title: string
  message: string
  related_quote_id: string | null
  support_thread_id: string | null
  support_message_id: string | null
  notification_date: string
  read_at: string | null
  created_at: string
}

export type SupportSenderRole = "user" | "admin"

export interface SupportThread {
  id: string
  user_id: string
  user_email: string | null
  updated_at: string
  last_body: string | null
  last_sender_role: SupportSenderRole | null
  unread_count: number
}

export interface SupportMessage {
  id: string
  thread_id: string
  sender_id: string | null
  sender_role: SupportSenderRole
  body: string
  created_at: string
}

export interface PaginatedItems<T> {
  items: T[]
  hasMore: boolean
}
