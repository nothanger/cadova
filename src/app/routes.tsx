
import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Modules } from "./pages/Modules";
import { ModuleDetail } from "./pages/ModuleDetail";
import { Pricing } from "./pages/Pricing";
import { Dashboard } from "./pages/Dashboard";
import { Applications } from "./pages/Applications";
import { Checkout } from "./pages/Checkout";
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
import { RouteErrorFallback } from "./components/RouteErrorFallback";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    errorElement: <RouteErrorFallback />,
    children: [
     
      { index: true, Component: Landing },
      { path: "modules", Component: Modules },
      { path: "modules/:slug", Component: ModuleDetail },
      { path: "pricing", Component: Pricing },
      { path: "formules", Component: Pricing },
      { path: "login", Component: Login },
      { path: "signup", Component: Signup },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "health", Component: HealthCheck },
      { path: "system-info", Component: SystemInfo },
      { path: "generate-icons", Component: GenerateIcons },

     
      {
        Component: AuthGuard,
        children: [
          { path: "dashboard", Component: Dashboard },
          { path: "suivi", Component: Applications },
          { path: "checkout", Component: Checkout },
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
      { path: "*", Component: RouteErrorFallback },
    ],
  },
]);
