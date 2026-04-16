import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/contexts/AuthContext";

export function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center"
        style={{ background: "#080719" }}
      >
        <div
          className="size-7 rounded-full border-2 animate-spin"
          style={{
            borderColor: "rgba(80,68,245,0.15)",
            borderTopColor: "#5044f5",
          }}
        />
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate to="/login" state={{ from: location }} replace />
    );
  }
  return <Outlet />;
}
