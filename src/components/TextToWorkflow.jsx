import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Wand2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { PromptingEngine } from '@/lib/promptingEngine';
import { useApp } from '@/context/AppContext';
import { trpc } from '@/lib/trpc';

const TextToWorkflow = ({ onWorkflowGenerated }) => {
  const { activeProvider, apiKey, userId } = useApp();
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(activeProvider?.models[0] || '');
  
  const trpcContext = trpc.useContext();
  const [promptingEngine] = useState(() => new PromptingEngine(trpcContext, userId));

  const handleGenerate = async () => {
    if (!textInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter some text to generate a workflow.",
        variant: "destructive",
      });
      return;
    }
    
    if (!activeProvider || !apiKey) {
      toast({
        title: "Provider Not Configured",
        description: "Please configure your AI provider in the setup page.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await promptingEngine.convertTextToWorkflow(
        textInput,
        apiKey,
        activeProvider.providerId,
        selectedModel
      );

      if (result.success) {
        onWorkflowGenerated(result.workflow);
        
        toast({
          title: "Workflow Generated",
          description: `Successfully converted text to workflow using ${result.metadata.generatedBy}`,
        });
        
        setTextInput('');
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error("Error generating workflow:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate workflow from text.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeProvider) {
    return null; // Or a placeholder indicating that a provider needs to be set up
  }

  return (
    <div className="border-t border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-4 h-auto text-left hover:bg-accent/50"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span className="font-medium">AI Text-to-Workflow</span>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="p-4 pt-0 space-y-4">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Input Text</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Convert text, research abstracts, or complex ideas into workflow nodes.
              </p>
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste your text here..."
                className="min-h-[120px]"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">AI Provider</Label>
                <Input value={activeProvider.name} disabled />
              </div>

              <div>
                <Label className="text-sm font-medium">Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProvider.models.map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generate Workflow
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default TextToWorkflow;
