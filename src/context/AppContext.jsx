import React, { createContext, useContext, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { SecureKeyManager } from '@/lib/security';

const AppContext = createContext();

export const AppProvider = ({ children, userId }) => {
  const [activeProvider, setActiveProvider] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [isProviderLoading, setIsProviderLoading] = useState(true);

  const { data: providers, isLoading: isConfigLoading, error } = trpc.provider.getConfig.useQuery({ userId }, {
    enabled: !!userId,
    retry: 1,
    onError: (err) => {
      console.error('Failed to load provider config:', err);
      setIsProviderLoading(false);
    }
  });

  useEffect(() => {
    if (providers) {
      const active = providers.find(p => p.isActive);
      if (active) {
        const key = SecureKeyManager.getApiKey(active.providerId);
        setActiveProvider(active);
        setApiKey(key);
      }
      setIsProviderLoading(false);
    } else if (error) {
      setIsProviderLoading(false);
    }
  }, [providers, error]);

  const value = {
    activeProvider,
    apiKey,
    isLoading: isProviderLoading || isConfigLoading,
    userId,
    error,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
