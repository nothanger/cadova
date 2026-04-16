import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { AuthGuard } from "./components/AuthGuard";
import { RouteErrorFallback } from "./components/RouteErrorFallback";

const loadComponent = <T extends Record<string, unknown>>(loader: () => Promise<T>, exportName: keyof T) =>
  async () => {
    const module = await loader();
    return { Component: module[exportName] as ComponentType };
  };

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    ErrorBoundary: RouteErrorFallback,
    children: [
      { index: true, lazy: loadComponent(() => import("./pages/Landing"), "Landing") },
      { path: "modules", lazy: loadComponent(() => import("./pages/Modules"), "Modules") },
      { path: "modules/comparaison", lazy: loadComponent(() => import("./pages/ModulesComparison"), "ModulesComparison") },
      { path: "modules/:slug", lazy: loadComponent(() => import("./pages/ModuleDetail"), "ModuleDetail") },
      { path: "pricing", lazy: loadComponent(() => import("./pages/Pricing"), "Pricing") },
      { path: "login", lazy: loadComponent(() => import("./pages/Login"), "Login") },
      { path: "signup", lazy: loadComponent(() => import("./pages/Signup"), "Signup") },
      { path: "forgot-password", lazy: loadComponent(() => import("./pages/ForgotPassword"), "ForgotPassword") },
      { path: "reset-password", lazy: loadComponent(() => import("./pages/ResetPassword"), "ResetPassword") },
      { path: "health", lazy: loadComponent(() => import("./pages/HealthCheck"), "HealthCheck") },
      { path: "system-info", lazy: loadComponent(() => import("./pages/SystemInfo"), "SystemInfo") },
      { path: "generate-icons", lazy: loadComponent(() => import("./icon-generator"), "default") },
      {
        Component: AuthGuard,
        children: [
          { path: "dashboard", lazy: loadComponent(() => import("./pages/Dashboard"), "Dashboard") },
          { path: "settings", lazy: loadComponent(() => import("./pages/Settings"), "SettingsPage") },
          { path: "cv-generator", lazy: loadComponent(() => import("./pages/CVGenerator"), "CVGenerator") },
          { path: "cover-letter", lazy: loadComponent(() => import("./pages/CoverLetter"), "CoverLetter") },
          { path: "ats-analysis", lazy: loadComponent(() => import("./pages/ATSAnalysis"), "ATSAnalysis") },
          { path: "interview", lazy: loadComponent(() => import("./pages/Interview"), "Interview") },
          { path: "company-finder", lazy: loadComponent(() => import("./pages/CompanyFinder"), "CompanyFinder") },
          { path: "linkedin", lazy: loadComponent(() => import("./pages/LinkedIn"), "LinkedIn") },
          { path: "skills", lazy: loadComponent(() => import("./pages/Skills"), "Skills") },
        ],
      },
    ],
  },
]);
