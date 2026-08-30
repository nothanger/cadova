/** Shared domain types for Cadova FollowUp. */

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused"

export type MemberRole = "owner" | "member"

export interface Company {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface CompanyMember {
  company_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export interface Client {
  id: string
  company_id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  company_id: string
  client_id: string
  reference: string
  amount_cents: number
  sent_at: string | null // ISO date (yyyy-mm-dd), no time
  status: QuoteStatus
  notes: string | null
  next_followup_at?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export type QuoteEventType =
  | "sent"
  | "followup"
  | "response"
  | "note"
  | "status_change"
  | "followup_scheduled"

export interface QuoteEvent {
  id: string
  company_id: string
  quote_id: string
  event_type: QuoteEventType
  content: string | null
  occurred_at: string
  created_by: string | null
}

/** A quote joined with its client name — the common read shape in lists. */
export interface QuoteWithClient extends Quote {
  client: Pick<Client, "id" | "name"> | null
}
