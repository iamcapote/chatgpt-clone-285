import { ThemeProvider } from "next-themes";
import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { trpc } from "./lib/trpc";
import { httpBatchLink } from '@trpc/client';
import { AppProvider, useApp } from './context/AppContext';
import ChatPage from "./pages/ChatPage";
import WorkflowBuilderPage from "./pages/WorkflowBuilderPage";
import LandingPage from "./pages/LandingPage";
import ProviderSetup from "./components/ProviderSetup"; // Renamed for clarity

const queryClient = new QueryClient();

const AppContent = () => {
  const { isLoading, activeProvider, userId } = useApp();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="animate-spin h-10 w-10 border-b-2 border-white rounded-full"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/setup" element={
          <div className="flex items-center justify-center h-screen bg-gray-900">
            <ProviderSetup userId={userId} onComplete={() => window.location.href = '/workflow'} />
          </div>
        } 
      />
      <Route 
        path="/workflow" 
        element={activeProvider ? <WorkflowBuilderPage /> : <Navigate to="/setup" />} 
      />
      <Route 
        path="/chat" 
        element={activeProvider ? <ChatPage /> : <Navigate to="/setup" />} 
      />
    </Routes>
  );
};

function App() {
  const [userId, setUserId] = useState(null);
  const [trpcClient, setTrpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:3002/api/trpc',
        }),
      ],
    })
  );

  useEffect(() => {
    let storedUserId = localStorage.getItem('userId');
    if (!storedUserId) {
      storedUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('userId', storedUserId);
    }
    setUserId(storedUserId);

    setTrpcClient(trpc.createClient({
      links: [
        httpBatchLink({
          url: typeof window !== 'undefined' && window.location.hostname.includes('app.github.dev')
            ? 'http://localhost:3002/api/trpc'
            : typeof window !== 'undefined'
              ? `${window.location.protocol}//${window.location.hostname.replace(/:\d+$/, '')}:3002/api/trpc`
              : 'http://localhost:3002/api/trpc',
          headers: () => ({
            'x-user-id': storedUserId,
          }),
        }),
      ],
    }));
  }, []);

  if (!userId) {
    return null; // Or a loading spinner
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TooltipProvider>
            <AppProvider userId={userId}>
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </AppProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
