import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  PenTool,
  Search,
  MessageSquare,
  MapPin,
  Settings,
  LogOut,
  Menu,
  X,
  Linkedin,
  Lightbulb,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CadovaLogo } from "./CadovaLogo";

// ── Navigation structure ───────────────────────────────────────────

const navSections = [
  {
    module: "TrackIA",
    accent: "#10B981",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", sub: "Vue d'ensemble", path: "/dashboard" },
      { icon: MapPin, label: "Carte Entreprises", sub: "Trouver un poste", path: "/company-finder" },
    ],
  },
  {
    module: "ReussIA",
    accent: "#5548F5",
    items: [
      { icon: FileText, label: "Générateur CV", sub: "Optimisé ATS", path: "/cv-generator" },
      { icon: PenTool, label: "Lettre de motivation", sub: "Sur-mesure IA", path: "/cover-letter" },
      { icon: Search, label: "Analyse ATS", sub: "Score & gaps", path: "/ats-analysis" },
    ],
  },
  {
    module: "OralIA",
    accent: "#EC4899",
    items: [
      { icon: MessageSquare, label: "Simulation entretien", sub: "Questions réalistes", path: "/interview" },
    ],
  },
  {
    module: "SkillIA",
    accent: "#F59E0B",
    items: [
      { icon: Linkedin, label: "LinkedIn", sub: "Profil optimisé", path: "/linkedin" },
      { icon: Lightbulb, label: "Compétences", sub: "Roadmap IA", path: "/skills" },
    ],
  },
];

// ── Sidebar content ────────────────────────────────────────────────

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Déconnexion réussie");
      navigate("/");
    } catch {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  const firstName = user?.name
    ? user.name.split(" ")[0]
    : user?.email?.split("@")[0] || "Utilisateur";

  const initials = firstName.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: "#0A0914", borderRight: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* ── Brand header ── */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <Link to="/dashboard" onClick={onClose}>
          <CadovaLogo width={72} white />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)" }}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ── Thin rule ── */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "0 20px" }} />

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navSections.map((section, si) => (
          <div key={section.module} className={si > 0 ? "mt-1" : ""}>
            {/* Module label */}
            <div className="flex items-center gap-2 px-3 py-2.5 mb-0.5">
              <span
                className="text-[9px] font-bold tracking-[0.18em] uppercase"
                style={{ color: section.accent, opacity: 0.7 }}
              >
                {section.module}
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: `${section.accent}18` }}
              />
            </div>

            {/* Items */}
            <div className="space-y-0.5 mb-2">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={onClose}>
                    <div
                      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
                      style={
                        isActive
                          ? {
                              background: `${section.accent}14`,
                              borderLeft: `2px solid ${section.accent}`,
                              paddingLeft: "10px",
                            }
                          : {
                              borderLeft: "2px solid transparent",
                              paddingLeft: "10px",
                            }
                      }
                    >
                      {/* Icon — minimal, no background */}
                      <item.icon
                        className="size-4 flex-shrink-0 transition-opacity"
                        style={{
                          color: isActive ? section.accent : "rgba(255,255,255,0.25)",
                        }}
                      />

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] leading-none mb-0.5 transition-colors truncate"
                          style={{
                            color: isActive ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.45)",
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          {item.label}
                        </p>
                        <p
                          className="text-[10px] leading-none truncate"
                          style={{ color: "rgba(255,255,255,0.18)" }}
                        >
                          {item.sub}
                        </p>
                      </div>

                      {/* Active dot */}
                      {isActive && (
                        <div
                          className="size-1.5 rounded-full flex-shrink-0"
                          style={{ background: section.accent }}
                        />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Settings */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "8px", paddingTop: "8px" }}>
          <Link to="/settings" onClick={onClose}>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
              style={{
                borderLeft: location.pathname === "/settings"
                  ? "2px solid rgba(255,255,255,0.2)"
                  : "2px solid transparent",
                paddingLeft: "10px",
                color: location.pathname === "/settings"
                  ? "rgba(255,255,255,0.7)"
                  : "rgba(255,255,255,0.25)",
              }}
            >
              <Settings className="size-4 flex-shrink-0" />
              <span className="text-[13px]">Paramètres</span>
            </div>
          </Link>
        </div>
      </nav>

      {/* ── User footer — editorial strip ── */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "12px 14px",
        }}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="size-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-[12px] font-semibold truncate"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {firstName}
            </p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              Plan gratuit
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="size-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10 flex-shrink-0"
            title="Déconnexion"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Layout ────────────────────────────────────────────────────

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ background: "#F4F3FB" }}>

      {/* Desktop sidebar — fixed */}
      <aside className="hidden lg:flex w-56 flex-col fixed h-full shadow-2xl" style={{ zIndex: 40 }}>
        <SidebarContent />
      </aside>

      {/* Mobile — backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 lg:hidden backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.65)", zIndex: 3000 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile — drawer */}
      <aside
        className={`fixed inset-y-0 left-0 w-60 transform transition-transform duration-300 ease-out lg:hidden shadow-2xl ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ zIndex: 3100 }}
      >
        <SidebarContent onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content area */}
      <div className="flex-1 lg:ml-56 min-h-screen flex flex-col">

        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 flex items-center justify-between px-4 py-3"
          style={{
            background: "#0A0914",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="size-9 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
          >
            <Menu className="size-5" />
          </button>

          <CadovaLogo width={54} white />

          <div className="size-9" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
