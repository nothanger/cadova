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

const navSections = [
  {
    module: "TrackIA",
    accent: "#14b8a6",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", sub: "Vue d'ensemble", path: "/dashboard" },
      { icon: MapPin, label: "Entreprises", sub: "Pistes a explorer", path: "/company-finder" },
    ],
  },
  {
    module: "ReussIA",
    accent: "#5044f5",
    items: [
      { icon: FileText, label: "Mon CV", sub: "A rendre plus clair", path: "/cv-generator" },
      { icon: PenTool, label: "Ma lettre", sub: "A adapter sans galere", path: "/cover-letter" },
      { icon: Search, label: "Analyse ATS", sub: "Ce qui manque", path: "/ats-analysis" },
    ],
  },
  {
    module: "OralIA",
    accent: "#d946ef",
    items: [
      { icon: MessageSquare, label: "Entretien", sub: "S'entrainer avant", path: "/interview" },
    ],
  },
  {
    module: "SkillIA",
    accent: "#2563eb",
    items: [
      { icon: Linkedin, label: "LinkedIn", sub: "Profil plus lisible", path: "/linkedin" },
      { icon: Lightbulb, label: "Competences", sub: "Quoi mettre en avant", path: "/skills" },
    ],
  },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("A bientot");
      navigate("/");
    } catch {
      toast.error("La deconnexion a bloque.");
    }
  };

  const firstName = user?.name ? user.name.split(" ")[0] : user?.email?.split("@")[0] || "Utilisateur";
  const initials = firstName.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full select-none flex-col bg-[var(--cadova-navy)] text-white">
      <div
        className="absolute inset-0 pointer-events-none opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px), radial-gradient(circle at 80% 0%, rgba(80,68,245,0.22), transparent 25%)",
          backgroundSize: "48px 48px, 48px 48px, auto",
        }}
      />
      <div className="relative z-10 flex items-center justify-between px-5 pb-4 pt-5">
        <Link to="/dashboard" onClick={onClose} className="inline-flex">
          <CadovaLogo width={78} white />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-[8px] bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="relative z-10 mx-5 h-px bg-white/10" />

      <nav className="relative z-10 flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section, si) => (
          <div key={section.module} className={si > 0 ? "mt-2" : ""}>
            <div className="mb-1 flex items-center gap-2 px-3 py-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: section.accent }}>
                {section.module}
              </span>
              <div className="h-px flex-1" style={{ background: `${section.accent}30` }} />
            </div>

            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={onClose} className="block no-underline">
                    <div
                      className="group flex items-center gap-3 rounded-[8px] border px-3 py-2.5 transition-all"
                      style={{
                        background: isActive ? `${section.accent}18` : "transparent",
                        borderColor: isActive ? `${section.accent}44` : "transparent",
                      }}
                    >
                      <item.icon
                        className="size-4 shrink-0"
                        style={{ color: isActive ? section.accent : "rgba(255,255,255,0.34)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 truncate text-[13px] font-semibold leading-none" style={{ color: isActive ? "white" : "rgba(255,255,255,0.58)" }}>
                          {item.label}
                        </p>
                        <p className="truncate text-[10px] leading-none text-white/24">{item.sub}</p>
                      </div>
                      {isActive && <div className="size-1.5 shrink-0 rounded-full" style={{ background: section.accent }} />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-3 border-t border-white/10 pt-3">
          <Link to="/settings" onClick={onClose} className="block no-underline">
            <div
              className="flex items-center gap-3 rounded-[8px] border px-3 py-2.5 transition-all"
              style={{
                background: location.pathname === "/settings" ? "rgba(255,255,255,0.08)" : "transparent",
                borderColor: location.pathname === "/settings" ? "rgba(255,255,255,0.14)" : "transparent",
                color: location.pathname === "/settings" ? "white" : "rgba(255,255,255,0.48)",
              }}
            >
              <Settings className="size-4 shrink-0" />
              <span className="text-[13px] font-semibold">Parametres</span>
            </div>
          </Link>
        </div>
      </nav>

      <div className="relative z-10 border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,#5044f5,#7c5cff)] text-xs font-extrabold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-white/80">{firstName}</p>
            <p className="text-[10px] text-white/32">Espace candidature</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-white/30 transition hover:bg-red-500/10 hover:text-red-200"
            title="Deconnexion"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-[100svh] bg-[var(--cadova-bg-soft)]">
      <aside className="fixed hidden h-full w-60 flex-col overflow-hidden shadow-2xl lg:flex" style={{ zIndex: 40 }}>
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 backdrop-blur-sm lg:hidden"
          style={{ background: "rgba(8,7,25,0.68)", zIndex: 3000 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 transform overflow-hidden shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ zIndex: 3100 }}
      >
        <SidebarContent onClose={() => setSidebarOpen(false)} />
      </aside>

      <div className="flex min-h-[100svh] flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--cadova-border)] bg-[rgba(247,247,249,0.86)] px-4 py-3 backdrop-blur-lg lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex size-10 items-center justify-center rounded-[8px] border border-[var(--cadova-border)] bg-white text-[var(--cadova-text)]"
          >
            <Menu className="size-5" />
          </button>
          <CadovaLogo width={58} />
          <div className="size-10" />
        </header>

        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
