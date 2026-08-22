import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { navItems } from "./nav-items";
import { AppProvider } from "./contexts/AppContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" aria-live="polite">
      <div className="h-7 w-40 rounded-lg bg-slate-200 animate-pulse" />
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ))}
      </div>
      <span className="sr-only">正在加载页面</span>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-400">正在恢复安全会话…</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <AppProvider>
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {navItems.map(({ to, page }) => (
              <Route key={to} path={to} element={page} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </AppProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster richColors position="top-right" />
      <HashRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
