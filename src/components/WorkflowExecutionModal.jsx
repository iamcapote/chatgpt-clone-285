import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Settings, FileText, Code, Database, Globe, FileJson, FileX2, Loader2, CheckCircle, Download, Copy } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { trpcVanilla } from '@/lib/trpc-vanilla';
import PromptingEngine from '@/lib/promptingEngine';
import { exportWorkflow } from '@/lib/exportUtils';

const WorkflowExecutionModal = ({ workflow, trigger, onExecutionComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [outputFormat, setOutputFormat] = useState('json');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([1500]);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [promptingEngine] = useState(() => new PromptingEngine(trpcVanilla, "demo-user"));
  const [executionResult, setExecutionResult] = useState(null);
  const [structuredWorkflow, setStructuredWorkflow] = useState('');

  const formatOptions = [
    { value: 'json', label: 'JSON', icon: FileJson, description: 'Technical/API format' },
    { value: 'markdown', label: 'Markdown', icon: FileText, description: 'Documentation format' },
    { value: 'yaml', label: 'YAML', icon: Code, description: 'Configuration format' },
    { value: 'xml', label: 'XML', icon: FileX2, description: 'Enterprise/Legacy format' }
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
          
          // Use powerful model for workflow execution
          const recommendedModels = promptingEngine.getRecommendedModels('workflow-execution');
          const availableModel = activeProvider.models.find(m => recommendedModels.includes(m)) || activeProvider.models[0];
          setSelectedModel(availableModel);
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
      }
    };
    loadProviders();
  }, [promptingEngine]);

  // Update structured workflow when format changes
  useEffect(() => {
    if (workflow && isOpen) {
      try {
        const exported = exportWorkflow(workflow, outputFormat);
        setStructuredWorkflow(exported.content);
      } catch (error) {
        console.error('Failed to export workflow:', error);
        setStructuredWorkflow('Error formatting workflow');
      }
    }
  }, [workflow, outputFormat, isOpen]);

  const handleExecute = async () => {
    if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
      toast({
        title: "Empty Workflow",
        description: "Add some nodes to your workflow before executing.",
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

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await promptingEngine.executeWorkflowWithFormat(
        workflow,
        outputFormat,
        {
          temperature: temperature[0],
          maxTokens: maxTokens[0],
          providerId: selectedProvider,
          model: selectedModel,
          apiKey: providerApiKey
        }
      );

      if (result.success) {
        setExecutionResult(result.execution);
        
        toast({
          title: "Workflow Executed",
          description: `Successfully executed using ${result.execution.provider} - ${selectedModel}`,
        });

        if (onExecutionComplete) {
          onExecutionComplete(result.execution);
        }
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error("Error executing workflow:", error);
      toast({
        title: "Execution Failed",
        description: error.message || "Could not execute workflow.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyResult = () => {
    if (executionResult) {
      navigator.clipboard.writeText(executionResult.result);
      toast({
        title: "Copied to Clipboard",
        description: "Execution result copied to clipboard.",
      });
    }
  };

  const handleDownloadResult = () => {
    if (executionResult) {
      const blob = new Blob([executionResult.result], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-execution-${outputFormat}-${new Date().toISOString().split('T')[0]}.${outputFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatIcon = formatOptions.find(f => f.value === outputFormat)?.icon || FileJson;
  const FormatIcon = formatIcon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" className="gap-2">
            <Play className="h-4 w-4" />
            Execute Workflow
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execute Workflow with AI</DialogTitle>
          <DialogDescription>
            Convert your workflow to a structured format and execute it with AI reasoning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Workflow Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {workflow?.metadata?.title || 'Untitled Workflow'}
                <Badge variant="outline">{workflow?.nodes?.length || 0} nodes</Badge>
              </CardTitle>
              <CardDescription>
                This workflow will be structured as {outputFormat.toUpperCase()} and executed with AI reasoning
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Execution Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Output Format */}
            <div>
              <Label className="text-sm font-medium">Output Format</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select output format" />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map(format => (
                    <SelectItem key={format.value} value={format.value}>
                      <div className="flex items-center gap-2">
                        <format.icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{format.label}</div>
                          <div className="text-sm text-muted-foreground">{format.description}</div>
                        </div>
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
              <Label className="text-sm font-medium">Temperature: {temperature[0]}</Label>
              <Slider
                value={temperature}
                onValueChange={setTemperature}
                min={0}
                max={1.5}
                step={0.1}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Higher values for more creative reasoning
              </p>
            </div>
          </div>

          {/* Structured Workflow Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FormatIcon className="h-5 w-5" />
                Structured Workflow ({outputFormat.toUpperCase()})
              </CardTitle>
              <CardDescription>
                This is how your workflow will be presented to the AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-40 w-full">
                <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                  {structuredWorkflow}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Execution Result */}
          {executionResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Execution Result
                </CardTitle>
                <CardDescription>
                  Executed using {executionResult.provider} - {executionResult.model}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-60 w-full">
                  <pre className="text-sm bg-muted p-4 rounded-lg whitespace-pre-wrap">
                    {executionResult.result}
                  </pre>
                </ScrollArea>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Format: {executionResult.format}</span>
                  <span>•</span>
                  <span>Executed: {new Date(executionResult.executedAt).toLocaleString()}</span>
                  {executionResult.usage && (
                    <>
                      <span>•</span>
                      <span>Tokens: {executionResult.usage.total_tokens || 'N/A'}</span>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCopyResult} variant="outline" className="flex-1">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Result
                  </Button>
                  <Button onClick={handleDownloadResult} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Execute Button */}
          <Button 
            onClick={handleExecute} 
            disabled={isExecuting || !workflow?.nodes?.length}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing Workflow...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Execute Workflow as {outputFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowExecutionModal;
