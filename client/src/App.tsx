import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/auth-context';
import ProtectedRoute from '@/components/protected-route';

// Import pages
import Dashboard from './pages/dashboard';
import AdminPage from './pages/admin';
import ConfigPage from './pages/config';
import MatchesPage from './pages/matches';
import QueuePage from './pages/queue';
import LeaderboardsPage from './pages/leaderboards';
import PlayersPage from './pages/players';
import SeasonsPage from './pages/seasons';
import HistoryPage from './pages/history';
import NotFoundPage from './pages/not-found';
import LoginPage from './pages/login';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="/config" element={
              <ProtectedRoute>
                <ConfigPage />
              </ProtectedRoute>
            } />

            {/* Public Routes */}
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/leaderboards" element={<LeaderboardsPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/seasons" element={<SeasonsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;