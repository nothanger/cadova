import { Navigate, Route, Routes } from "react-router-dom"
import {
  PublicOnly,
  RequireAuth,
  RequireCompany,
  RequireNoCompany,
  RequireAdmin,
} from "./guards"
import { AppLayout } from "@/components/layout/AppLayout"
import { LandingPage } from "@/features/landing/LandingPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { SignupPage } from "@/features/auth/SignupPage"
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage"
import { OnboardingPage } from "@/features/company/OnboardingPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { ClientsListPage } from "@/features/clients/ClientsListPage"
import { ClientFormPage } from "@/features/clients/ClientFormPage"
import { ClientDetailPage } from "@/features/clients/ClientDetailPage"
import { QuotesListPage } from "@/features/quotes/QuotesListPage"
import { QuoteFormPage } from "@/features/quotes/QuoteFormPage"
import { QuoteDetailPage } from "@/features/quotes/QuoteDetailPage"
import { SettingsPage } from "@/features/settings/SettingsPage"
import { LegalPage } from "@/features/legal/LegalPage"
import { AdminPage } from "@/features/admin/AdminPage"
import { NotificationsPage } from "@/features/notifications/NotificationsPage"
import { QuotePortalPage } from "@/features/quote-portal/QuotePortalPage"

export function AppRoutes() {
  return (
    <Routes>
      {/* Public landing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/devis/suivi" element={<QuotePortalPage />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="/legal-notice" element={<LegalPage kind="legal-notice" />} />
      <Route path="/cookies" element={<LegalPage kind="cookies" />} />

      {/* Auth pages — redirect connected users into app */}
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <SignupPage />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPasswordPage />
          </PublicOnly>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Authenticated */}
      <Route element={<RequireAuth />}>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/onboarding"
          element={
            <RequireNoCompany>
              <OnboardingPage />
            </RequireNoCompany>
          }
        />

        {/* Authenticated + has a company */}
        <Route element={<RequireCompany />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />

            <Route path="clients" element={<ClientsListPage />} />
            <Route path="clients/new" element={<ClientFormPage mode="new" />} />
            <Route path="clients/:clientId" element={<ClientDetailPage />} />
            <Route
              path="clients/:clientId/edit"
              element={<ClientFormPage mode="edit" />}
            />

            <Route path="quotes" element={<QuotesListPage />} />
            <Route path="quotes/new" element={<QuoteFormPage mode="new" />} />
            <Route path="quotes/:quoteId" element={<QuoteDetailPage />} />
            <Route
              path="quotes/:quoteId/edit"
              element={<QuoteFormPage mode="edit" />}
            />

            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
