import React, { createContext, useContext, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { SecureKeyManager } from '@/lib/security';

const AppContext = createContext();

export const AppProvider = ({ children, userId }) => {
  const [activeProvider, setActiveProvider] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [isProviderLoading, setIsProviderLoading] = useState(true);

  const { data: providers, isLoading: isConfigLoading } = trpc.provider.getConfig.useQuery({ userId }, {
    enabled: !!userId,
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
    }
  }, [providers]);

  const value = {
    activeProvider,
    apiKey,
    isLoading: isProviderLoading || isConfigLoading,
    userId,
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
