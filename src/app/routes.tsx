/**
 * routes.tsx — React Router Data Mode
 *
 * Structure de protection :
 *   / (Root)
 *   ├── index          → Landing     (publique)
 *   ├── login          → Login       (publique)
 *   ├── signup         → Signup      (publique)
 *   ├── forgot-password→ ForgotPassword (publique)
 *   ├── reset-password → ResetPassword (publique)
 *   ├── health         → HealthCheck (publique)
 *   ├── system-info    → SystemInfo  (publique)
 *   └── [AuthGuard]    → layout route sans chemin propre
 *       ├── dashboard
 *       ├── settings
 *       ├── cv-generator
 *       ├── cover-letter
 *       ├── ats-analysis
 *       ├── interview
 *       ├── company-finder
 *       ├── linkedin
 *       └── skills
 *
 * AuthGuard est un layout component (sans path) qui rend <Outlet />
 * si l'utilisateur est connecté, sinon redirige vers /login.
 * C'est le pattern natif React Router pour protéger des routes.
 */

import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Dashboard } from "./pages/Dashboard";
import { SettingsPage } from "./pages/Settings";
import { CVGenerator } from "./pages/CVGenerator";
import { CoverLetter } from "./pages/CoverLetter";
import { ATSAnalysis } from "./pages/ATSAnalysis";
import { Interview } from "./pages/Interview";
import { CompanyFinder } from "./pages/CompanyFinder";
import { LinkedIn } from "./pages/LinkedIn";
import { Skills } from "./pages/Skills";
import { HealthCheck } from "./pages/HealthCheck";
import { SystemInfo } from "./pages/SystemInfo";
import GenerateIcons from "./icon-generator";
import { AuthGuard } from "./components/AuthGuard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      // ── Routes publiques ──────────────────────────────────────
      { index: true, Component: Landing },
      { path: "login", Component: Login },
      { path: "signup", Component: Signup },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "health", Component: HealthCheck },
      { path: "system-info", Component: SystemInfo },
      { path: "generate-icons", Component: GenerateIcons },

      // ── Routes protégées ─────────────────────────────────────
      {
        Component: AuthGuard,
        children: [
          { path: "dashboard", Component: Dashboard },
          { path: "settings", Component: SettingsPage },
          { path: "cv-generator", Component: CVGenerator },
          { path: "cover-letter", Component: CoverLetter },
          { path: "ats-analysis", Component: ATSAnalysis },
          { path: "interview", Component: Interview },
          { path: "company-finder", Component: CompanyFinder },
          { path: "linkedin", Component: LinkedIn },
          { path: "skills", Component: Skills },
        ],
      },
    ],
  },
]);