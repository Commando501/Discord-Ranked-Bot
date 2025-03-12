import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AdminPage from "@/pages/admin";
import ConfigPage from "@/pages/config";
import QueuePage from "@/pages/queue";
import MatchesPage from "@/pages/matches";
import HistoryPage from "@/pages/history";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/config" component={ConfigPage} />
      
      {/* Matchmaking routes */}
      <Route path="/queue" component={QueuePage} />
      <Route path="/matches" component={MatchesPage} />
      <Route path="/history" component={HistoryPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
