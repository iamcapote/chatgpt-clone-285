import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TestTube2, Plus, Trash2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/use-toast";
import { SecureKeyManager } from '@/lib/security';

const ProviderSetup = ({ userId, onComplete }) => {
  const { toast } = useToast();
  const [providers, setProviders] = useState([]);
  const [apiKeys, setApiKeys] = useState({});
  const [selectedProvider, setSelectedProvider] = useState('venice');
  const [showApiKeys, setShowApiKeys] = useState({});
  const [isValid, setIsValid] = useState(false);

  const { data: initialProviders, isLoading, refetch } = trpc.provider.getConfig.useQuery({ userId });
  const updateConfigMutation = trpc.provider.updateConfig.useMutation();
  const testNodeMutation = trpc.provider.testNode.useMutation();

  useEffect(() => {
    if (initialProviders) {
      setProviders(initialProviders);
      const initialApiKeys = {};
      const hasValidProvider = initialProviders.some(p => {
        const key = SecureKeyManager.getApiKey(p.providerId);
        if (key) {
          initialApiKeys[p.providerId] = key;
          return true;
        }
        return false;
      });
      setApiKeys(initialApiKeys);
      setIsValid(hasValidProvider);
    }
  }, [initialProviders]);

  const handleProviderUpdate = (providerId, field, value) => {
    setProviders(prev => {
      const updated = prev.map(p => 
        p.providerId === providerId ? { ...p, [field]: value } : p
      );
      return updated;
    });
  };

  const handleApiKeyChange = (providerId, value) => {
    setApiKeys(prev => ({ ...prev, [providerId]: value }));
    const hasValidProvider = providers.some(p => apiKeys[p.providerId] && apiKeys[p.providerId].trim() !== '');
    setIsValid(hasValidProvider);
  };

  const handleSaveAndContinue = async () => {
    try {
      // Store keys in session storage
      Object.entries(apiKeys).forEach(([providerId, key]) => {
        if (key && key.trim()) {
          SecureKeyManager.storeApiKey(providerId, key);
        }
      });

      // Prepare providers data for backend (without API keys)
      const providersToSave = providers.map(p => {
        const { apiKey, ...rest } = p;
        return rest;
      });

      await updateConfigMutation.mutateAsync(providersToSave);
      
      // Store the active provider's API key in session storage for immediate use
      const activeProvider = providers.find(p => p.isActive);
      if (activeProvider && apiKeys[activeProvider.providerId]) {
        sessionStorage.setItem('openai_api_key', apiKeys[activeProvider.providerId]);
      }
      
      toast({ title: "Success", description: "Provider settings saved." });
      
      if (onComplete) onComplete();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
  };

  const handleTestProvider = async (providerId, model) => {
    try {
      const apiKey = apiKeys[providerId];
      if (!apiKey) {
        toast({ title: "API Key Missing", description: "Please enter an API key for this provider.", variant: "destructive" });
        return;
      }
      const result = await testNodeMutation.mutateAsync({
        nodeId: 'test-node',
        nodeType: 'Test',
        content: 'Hello, this is a test prompt to verify the connection.',
        providerId,
        model,
        apiKey, // Pass key directly to test mutation
        parameters: { temperature: 0.7, max_tokens: 50, top_p: 1 },
      });
      toast({ 
        title: "Test Successful", 
        description: `${result.provider} responded: "${result.result.substring(0, 50)}..."` 
      });
    } catch (error) {
      toast({ title: "Test Failed", description: error.message, variant: "destructive" });
    }
  };

  const toggleApiKeyVisibility = (providerId) => {
    setShowApiKeys(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const handleActivateProvider = (providerId) => {
    setProviders(prev => prev.map(p => ({
      ...p,
      isActive: p.providerId === providerId
    })));
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-b-2 border-white rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Configure AI Providers</h2>
          <p className="text-blue-100">Choose and configure your AI providers to get started with Semantic Canvas</p>
        </div>

        <Tabs value={selectedProvider} onValueChange={setSelectedProvider} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {providers.map(provider => (
              <TabsTrigger key={provider.providerId} value={provider.providerId} className="flex items-center gap-2">
                {provider.name}
                {provider.isActive && <Badge variant="secondary" className="text-xs">Active</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>

          {providers.map(provider => (
            <TabsContent key={provider.providerId} value={provider.providerId}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-white">{provider.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={provider.isActive}
                        onCheckedChange={() => handleActivateProvider(provider.providerId)}
                      />
                      <Label className="text-white">Active</Label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-white">Base URL</Label>
                    <Input
                      className="bg-white/10 border-white/20 text-white placeholder-white/50"
                      value={provider.baseURL}
                      onChange={(e) => handleProviderUpdate(provider.providerId, 'baseURL', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-white">API Key</Label>
                    <div className="relative">
                      <Input
                        className="bg-white/10 border-white/20 text-white placeholder-white/50 pr-10"
                        type={showApiKeys[provider.providerId] ? "text" : "password"}
                        value={provider.apiKey}
                        onChange={(e) => handleProviderUpdate(provider.providerId, 'apiKey', e.target.value)}
                        placeholder="Enter your API key..."
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
                        onClick={() => toggleApiKeyVisibility(provider.providerId)}
                      >
                        {showApiKeys[provider.providerId] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-white">Available Models</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {provider.models.map(model => (
                        <Badge key={model} variant="outline" className="flex items-center gap-1 text-white border-white/20">
                          {model}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTestProvider(provider.providerId, model)}
                            disabled={!provider.apiKey || testNodeMutation.isLoading}
                            className="h-4 w-4 p-0 text-white/70 hover:text-white"
                          >
                            <TestTube2 className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {provider.apiKey && (
                    <div className="pt-4 border-t border-white/10">
                      <Button
                        variant="outline"
                        onClick={() => handleTestProvider(provider.providerId, provider.models[0])}
                        disabled={testNodeMutation.isLoading}
                        className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <TestTube2 className="h-4 w-4 mr-2" />
                        Test Connection
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-8 flex justify-between items-center">
          <p className="text-blue-100 text-sm">
            {isValid ? "✓ Ready to proceed" : "Please configure at least one provider with an API key"}
          </p>
          <Button
            onClick={handleSaveAndContinue}
            disabled={!isValid || updateConfigMutation.isLoading}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            {updateConfigMutation.isLoading ? "Saving..." : "Save & Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProviderSetup;
