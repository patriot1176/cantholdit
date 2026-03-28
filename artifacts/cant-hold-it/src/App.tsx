import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileProvider } from "@/contexts/profile-context";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import StopDetail from "@/pages/stop-detail";
import RateStop from "@/pages/rate-stop";
import AddStop from "@/pages/add-stop";
import About from "@/pages/about";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/stop/:id" component={StopDetail} />
      <Route path="/stop/:id/rate" component={RateStop} />
      <Route path="/add-stop" component={AddStop} />
      <Route path="/about" component={About} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ProfileProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </ProfileProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
