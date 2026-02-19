import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
