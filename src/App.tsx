import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "@/routes/AppRoutes";

/**
 * Central application shell.
 * - Provides React Query client
 * - Global tooltips & toasters
 * - BrowserRouter wrapping the extracted AppRoutes
 * - Suspense fallback for any lazy‑loaded routes/components
 *
 * If you later add route guards (e.g. ProfileGuard, AuthGuard),
 * they should wrap <AppRoutes /> here or individual Route groups inside AppRoutes.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Adjust according to your API reliability
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={200}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-screen">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          }
        >
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;