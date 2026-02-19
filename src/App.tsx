import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { AuthProvider } from "@/context/AuthContext.jsx";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FAASForm from "./pages/FAASForm";
import Approvals from "./pages/Approvals";
import Drafts from "./pages/Drafts";
import PrintPreview from "./pages/PrintPreview";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* ⚠️ ADD THIS LINE - It tells React to NOT handle /api/* routes */}
            <Route path="/api/*" element={null} />
            
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Login />} />
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route element={<RoleGuard allowedRoles={["encoder", "administrator"]} />}>
                <Route path="/drafts" element={<Drafts />} />
                <Route path="/faas/new" element={<FAASForm />} />
                <Route path="/faas/:id" element={<FAASForm />} />
                <Route path="/faas/:id/edit" element={<FAASForm />} />
              </Route>
              <Route element={<RoleGuard allowedRoles={["approver", "administrator"]} />}>
                <Route path="/approvals" element={<Approvals />} />
              </Route>
              <Route path="/print" element={<PrintPreview />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;