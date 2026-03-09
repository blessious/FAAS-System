import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background relative">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
