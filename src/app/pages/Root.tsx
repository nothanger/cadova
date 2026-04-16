import { Outlet } from "react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";

export function Root() {
  useEffect(() => {
    document.title = "Cadova - IA pour CV, entretiens et candidatures";
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-[100svh]">
        <Toaster richColors position="top-right" />
        <Outlet />
      </div>
    </AuthProvider>
  );
}
