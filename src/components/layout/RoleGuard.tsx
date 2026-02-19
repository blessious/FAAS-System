import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext.jsx";
import { Loader2 } from "lucide-react";

type Role = "encoder" | "approver" | "administrator";

interface RoleGuardProps {
  /** Roles that can access the wrapped routes. Administrator always has access. */
  allowedRoles: readonly Role[] | Role[];
}

/**
 * Protects nested routes by role. Renders <Outlet /> only if the current user's
 * role is in allowedRoles or is administrator. Otherwise redirects to /dashboard.
 */
export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Checking access...</span>
        </div>
      </div>
    );
  }

  if (!user || !userRole) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess =
    userRole === "administrator" ||
    (allowedRoles as string[]).includes(userRole);

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
