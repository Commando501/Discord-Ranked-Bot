import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AdminPage from "@/pages/admin";
import ConfigPage from "@/pages/config";
import QueuePage from "@/pages/queue";
import MatchesPage from "@/pages/matches";
import HistoryPage from "@/pages/history";
import PlayersPage from "@/pages/players";
import LeaderboardsPage from "@/pages/leaderboards";
import SeasonsPage from "@/pages/seasons";
import LoginPage from "@/pages/login-page";

function Router() {
  return (
    <Switch>
      {/* Login page - not protected */}
      <Route path="/login" component={LoginPage} />
      
      {/* All other routes protected */}
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute>
          <AdminPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/config">
        <ProtectedRoute>
          <ConfigPage />
        </ProtectedRoute>
      </Route>
      
      {/* Matchmaking routes */}
      <Route path="/queue">
        <ProtectedRoute>
          <QueuePage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/matches">
        <ProtectedRoute>
          <MatchesPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/history">
        <ProtectedRoute>
          <HistoryPage />
        </ProtectedRoute>
      </Route>
      
      {/* Players routes */}
      <Route path="/players">
        <ProtectedRoute>
          <PlayersPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/leaderboards">
        <ProtectedRoute>
          <LeaderboardsPage />
        </ProtectedRoute>
      </Route>
      
      {/* Seasons routes */}
      <Route path="/seasons">
        <ProtectedRoute>
          <SeasonsPage />
        </ProtectedRoute>
      </Route>
      
      <Route>
        <ProtectedRoute>
          <NotFound />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
