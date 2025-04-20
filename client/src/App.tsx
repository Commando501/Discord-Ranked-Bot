import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/ui/theme-provider";
import { Toaster } from "./components/ui/toaster";
import Dashboard from "./pages/dashboard";
import QueuePage from "./pages/queue";
import HistoryPage from "./pages/history";
import MatchesPage from "./pages/matches";
import PlayersPage from "./pages/players";
import LeaderboardsPage from "./pages/leaderboards";
import ConfigPage from "./pages/config";
import AdminPage from "./pages/admin";
import NotFoundPage from "./pages/not-found";
import AppLayout from "./components/layout/app-layout";
import LoginPage from "./components/login-page";
import { useState, useEffect } from "react";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check authentication status on mount
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => {
        setIsAuthenticated(data.authenticated);
        if (data.authenticated) {
          setUser(data.user);
        }
      })
      .catch(err => {
        console.error('Error checking auth status:', err);
        setIsAuthenticated(false);
      });
  }, []);

  // While checking auth status, show loading
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#36393F]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#5865F2]"></div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="discord-bot-ui-theme">
      <BrowserRouter>
        {!isAuthenticated ? (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<AppLayout user={user} />}>
              <Route index element={<Dashboard />} />
              <Route path="queue" element={<QueuePage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="players" element={<PlayersPage />} />
              <Route path="leaderboards" element={<LeaderboardsPage />} />
              <Route path="config" element={<ConfigPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </BrowserRouter>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;