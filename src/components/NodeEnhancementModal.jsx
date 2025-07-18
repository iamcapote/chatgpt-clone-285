import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, CheckCircle, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { trpcVanilla } from '@/lib/trpc-vanilla';
import PromptingEngine from '@/lib/promptingEngine';

const NodeEnhancementModal = ({ node, onNodeUpdate, trigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementType, setEnhancementType] = useState('improve');
  const [selectedProvider, setSelectedProvider] = useState('venice');
  const [selectedModel, setSelectedModel] = useState('venice-uncensored');
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([800]);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [promptingEngine] = useState(() => new PromptingEngine(trpcVanilla, "demo-user"));
  const [enhancementResult, setEnhancementResult] = useState(null);

  const enhancementTypes = [
    { value: 'improve', label: 'Improve', description: 'Refine and enhance the content' },
    { value: 'optimize', label: 'Optimize', description: 'Improve clarity and precision' },
    { value: 'refactor', label: 'Refactor', description: 'Restructure for academic rigor' },
    { value: 'enhance', label: 'Enhance', description: 'Add sophisticated vocabulary' },
    { value: 'simplify', label: 'Simplify', description: 'Make clearer and more accessible' },
    { value: 'elaborate', label: 'Elaborate', description: 'Add detail and nuance' }
  ];

  // Load available providers on component mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providers = await promptingEngine.getAvailableProviders();
        setAvailableProviders(providers);
        if (providers.length > 0) {
          const activeProvider = providers.find(p => p.isActive) || providers[0];
          setSelectedProvider(activeProvider.providerId);
          
          // Use smaller model for node enhancement by default
          const recommendedModels = promptingEngine.getRecommendedModels('node-enhancement');
          const availableModel = activeProvider.models.find(m => recommendedModels.includes(m)) || activeProvider.models[0];
          setSelectedModel(availableModel);
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
      }
    };
    loadProviders();
  }, [promptingEngine]);

  const handleEnhance = async () => {
    if (!node || !node.data.content) {
      toast({
        title: "No Content",
        description: "This node has no content to enhance.",
        variant: "destructive",
      });
      return;
    }

    // Get API key from session storage for selected provider
    const providerApiKey = sessionStorage.getItem(`${selectedProvider}_api_key`);
    if (!providerApiKey) {
      toast({
        title: "API Key Missing",
        description: `Please configure your ${selectedProvider} API key in settings.`,
        variant: "destructive",
      });
      return;
    }

    setIsEnhancing(true);
    setEnhancementResult(null);

    try {
      const result = await promptingEngine.enhanceNode(
        node,
        enhancementType,
        {
          temperature: temperature[0],
          maxTokens: maxTokens[0],
          providerId: selectedProvider,
          model: selectedModel,
          apiKey: providerApiKey
        }
      );

      if (result.success) {
        setEnhancementResult(result.enhancement);
        
        toast({
          title: "Node Enhanced",
          description: `Successfully enhanced node using ${result.enhancement.provider}`,
        });
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error("Error enhancing node:", error);
      toast({
        title: "Enhancement Failed",
        description: error.message || "Could not enhance node.",
        variant: "destructive",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApplyEnhancement = () => {
    if (enhancementResult && onNodeUpdate) {
      const updatedNode = {
        ...node,
        data: {
          ...node.data,
          content: enhancementResult.enhancedContent
        }
      };
      onNodeUpdate(updatedNode);
      setIsOpen(false);
      toast({
        title: "Enhancement Applied",
        description: "Node content has been updated with the enhancement.",
      });
    }
  };

  const handleReset = () => {
    setEnhancementResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Enhance
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enhance Node with AI</DialogTitle>
          <DialogDescription>
            Improve, optimize, or refactor your node content using AI assistance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Node Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {node?.data.label}
                <Badge variant="secondary">{node?.data.type}</Badge>
              </CardTitle>
              <CardDescription>
                Current content to be enhanced
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">
                  {node?.data.content || 'No content available'}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Enhancement Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Enhancement Type */}
            <div>
              <Label className="text-sm font-medium">Enhancement Type</Label>
              <Select value={enhancementType} onValueChange={setEnhancementType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select enhancement type" />
                </SelectTrigger>
                <SelectContent>
                  {enhancementTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Provider Selection */}
            <div>
              <Label className="text-sm font-medium">AI Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map(provider => (
                    <SelectItem key={provider.providerId} value={provider.providerId}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
            <div>
              <Label className="text-sm font-medium">Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders
                    .find(p => p.providerId === selectedProvider)?.models
                    .map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    )) || []}
                </SelectContent>
              </Select>
            </div>

            {/* Temperature Control */}
            <div>
              <Label className="text-sm font-medium">Creativity: {temperature[0]}</Label>
              <Slider
                value={temperature}
                onValueChange={setTemperature}
                min={0}
                max={1.5}
                step={0.1}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Higher values for more creative enhancement
              </p>
            </div>
          </div>

          {/* Enhancement Result */}
          {enhancementResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Enhanced Content
                </CardTitle>
                <CardDescription>
                  Enhanced using {enhancementResult.provider} - {enhancementResult.model}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap">
                    {enhancementResult.enhancedContent}
                  </pre>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Enhancement type: {enhancementResult.enhancementType}</span>
                  <span>•</span>
                  <span>Enhanced: {new Date(enhancementResult.enhancedAt).toLocaleString()}</span>
                  {enhancementResult.usage && (
                    <>
                      <span>•</span>
                      <span>Tokens: {enhancementResult.usage.total_tokens || 'N/A'}</span>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleApplyEnhancement} className="flex-1">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Apply Enhancement
                  </Button>
                  <Button onClick={handleReset} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enhance Button */}
          <Button 
            onClick={handleEnhance} 
            disabled={isEnhancing || !node?.data.content}
            className="w-full"
          >
            {isEnhancing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enhancing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Enhance Node
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NodeEnhancementModal;
