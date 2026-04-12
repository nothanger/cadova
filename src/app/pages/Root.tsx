import { Outlet } from "react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";

export function Root() {
  useEffect(() => {
    document.title = "Cadova - L'écosystème IA pour l'emploi des jeunes";
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Toaster richColors position="top-right" />
        <Outlet />
      </div>
    </AuthProvider>
  );
}