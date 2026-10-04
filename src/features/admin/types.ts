export interface AdminUser {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  banned_until: string | null
  is_admin: boolean
  companies: { id: string; name: string; role: string }[]
}

export interface AdminCompany {
  id: string
  name: string
  created_at: string
  updated_at: string
  owners: { id: string; email: string | null }[]
}

export interface AdminUsersPage {
  users: AdminUser[]
  page: number
  hasMore: boolean
}

export interface AdminCompaniesPage {
  companies: AdminCompany[]
  page: number
  hasMore: boolean
}
