import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, MessageSquare, GitBranch, Play, Loader2, Download, FileJson, FileText, FileCode, FileX2, FolderOpen, Plus, LogOut } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';

import NodePalette from "../components/NodePalette";
import LabCanvas from "../components/LabCanvas";
import ConfigurationModal from "../components/ConfigurationModal";
import TextToWorkflow from "../components/TextToWorkflow";
import ThemeToggle from "../components/ThemeToggle";
import ClearSessionButton from "../components/ClearSessionButton";
import { createWorkflowSchema, generateId } from "../lib/graphSchema";
import { exportWorkflowAsJSON as exportAsJson, exportWorkflowAsYAML as exportAsYaml, exportWorkflowAsMarkdown as exportAsMarkdown, exportWorkflowAsXML as exportAsXml } from "../lib/exportUtils";
import { trpc } from "../lib/trpc";
import { toast } from "@/components/ui/use-toast";
import WorkflowExecutionEngine from "../lib/WorkflowExecutionEngine";
import { useApp } from '@/context/AppContext';

const WorkflowBuilderPage = () => {
  const { userId, activeProvider, apiKey } = useApp();
  const navigate = useNavigate();

  // tRPC queries
  const { data: workflows, refetch: refetchWorkflows } = trpc.workflow.list.useQuery({ userId }, {
    enabled: !!userId,
    retry: false,
    onError: (error) => {
      console.log('Backend not available, using localStorage fallback');
    }
  });

  const [workflow, setWorkflow] = useState(() => {
    // Try to load saved workflow from localStorage
    const saved = localStorage.getItem(`current-workflow-${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Failed to parse saved workflow:', error);
      }
    }
    
    // Create new workflow
    const newWorkflow = createWorkflowSchema();
    newWorkflow.id = generateId();
    newWorkflow.metadata.title = 'Untitled Workflow';
    newWorkflow.metadata.createdAt = new Date().toISOString();
    newWorkflow.metadata.updatedAt = new Date().toISOString();
    return newWorkflow;
  });
  
  const [activeTab, setActiveTab] = useState('canvas');
  const [isExecuting, setIsExecuting] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  // Settings state
  const [systemMessage, setSystemMessage] = useState(() => 
    sessionStorage.getItem('system_message') || 'You are processing a semantic logic workflow.'
  );
  
  // Save workflow to localStorage when it changes
  useEffect(() => {
    if (workflow && userId) {
      localStorage.setItem(`current-workflow-${userId}`, JSON.stringify(workflow));
    }
  }, [workflow, userId]);
  
  // Save settings to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('system_message', systemMessage);
  }, [systemMessage]);
  
  // Workflow management functions
  const createNewWorkflow = () => {
    const newWorkflow = createWorkflowSchema();
    newWorkflow.id = generateId();
    newWorkflow.metadata.title = 'Untitled Workflow';
    newWorkflow.metadata.createdAt = new Date().toISOString();
    newWorkflow.metadata.updatedAt = new Date().toISOString();
    setWorkflow(newWorkflow);
    toast({
      title: "New Workflow Created",
      description: "Started with a fresh workflow canvas.",
    });
  };

  const loadWorkflow = async (workflowId) => {
    try {
      const loadedWorkflow = await trpc.workflow.get.query(workflowId);
      if (loadedWorkflow) {
        setWorkflow({
          id: loadedWorkflow.id,
          nodes: loadedWorkflow.content?.nodes || [],
          edges: loadedWorkflow.content?.edges || [],
          viewport: loadedWorkflow.content?.viewport || { x: 0, y: 0, zoom: 1 },
          metadata: {
            id: loadedWorkflow.id,
            title: loadedWorkflow.title,
            description: loadedWorkflow.description,
            createdAt: loadedWorkflow.createdAt,
            updatedAt: loadedWorkflow.updatedAt,
            version: loadedWorkflow.version
          }
        });
        toast({
          title: "Workflow Loaded",
          description: `Loaded "${loadedWorkflow.title}" from database.`,
        });
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load workflow from database.",
        variant: "destructive",
      });
    }
  };
  
  const handleWorkflowChange = (updatedWorkflow) => {
    setWorkflow(updatedWorkflow);
  };

  const handleWorkflowGenerated = (generated) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, ...generated.nodes],
      edges: [...prev.edges, ...generated.edges],
    }));
  };
  
  const handleExecuteWorkflow = async () => {
    if (!workflow.nodes || workflow.nodes.length === 0) {
      toast({
        title: "Empty Workflow",
        description: "Add some nodes to your workflow before executing.",
        variant: "destructive",
      });
      return;
    }
    
    setIsExecuting(true);
    setActiveTab('test');
    
    try {
      const executionEngine = new WorkflowExecutionEngine("demo-user", toast);
      
      // Clear previous chat messages
      setChatMessages([{
        role: 'system',
        content: `🚀 Starting workflow execution: ${workflow.metadata.title}\n\nNodes: ${workflow.nodes.length}\nConnections: ${workflow.edges.length}`
      }]);
      
      // Execute workflow with progress updates
      const result = await executionEngine.executeWorkflow(workflow, (progress) => {
        let message = '';
        
        switch (progress.type) {
          case 'start':
            message = `🔄 ${progress.message}`;
            break;
          case 'node_start':
            message = `⚡ ${progress.message}`;
            break;
          case 'node_complete':
            message = `✅ ${progress.message}\n\n**Result:** ${progress.result}`;
            break;
          case 'node_error':
            message = `❌ ${progress.message}`;
            break;
          case 'complete':
            message = `🎉 ${progress.message}\n\n**Summary:**\n- Provider: ${result.provider}\n- Completed: ${result.completedNodes}/${result.totalNodes} nodes`;
            break;
        }
        
        setChatMessages(prev => [...prev, {
          role: progress.type.includes('error') ? 'system' : 'assistant',
          content: message
        }]);
      });
      
      toast({
        title: "Workflow Executed",
        description: `Successfully processed ${result.completedNodes}/${result.totalNodes} nodes using ${result.provider}`,
      });
      
    } catch (error) {
      console.error('Execution error:', error);
      
      const errorMessage = {
        role: 'system',
        content: `❌ Execution failed: ${error.message}`
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Execution Failed", 
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isExecuting) return;
    
    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    
    // For now, echo back - Engineer 2 will implement actual chat integration
    const assistantMessage = {
      role: 'assistant', 
      content: `[Test mode] You said: "${userMessage.content}"\n\nThis will be integrated with the workflow execution engine.`
    };
    
    setTimeout(() => {
      setChatMessages(prev => [...prev, assistantMessage]);
    }, 500);
  };
  
  const handleLogout = () => {
    // This is a simplified "logout" that sends the user back to the setup page
    // to re-configure their provider.
    navigate('/setup');
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold">Semantic Canvas</h1>
          <Badge variant="outline">{activeProvider?.name || 'No Provider'}</Badge>
        </div>
        <div className="flex-1 mx-4">
          <Input 
            value={workflow.metadata.title}
            onChange={(e) => setWorkflow(prev => ({ ...prev, metadata: { ...prev.metadata, title: e.target.value } }))}
            className="w-full max-w-md mx-auto text-center"
          />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
          <ClearSessionButton />
          <ConfigurationModal 
            systemMessage={systemMessage}
            setSystemMessage={setSystemMessage}
          />
        </div>
      </header>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-border">
              <h2 className="text-md font-semibold">Tools</h2>
            </div>
            <ScrollArea className="flex-1">
              <NodePalette />
              <TextToWorkflow onWorkflowGenerated={handleWorkflowGenerated} />
            </ScrollArea>
            <div className="p-2 border-t border-border">
              <h2 className="text-md font-semibold">Workflows</h2>
              <div className="mt-2 space-y-2">
                <Button onClick={createNewWorkflow} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> New
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <FolderOpen className="mr-2 h-4 w-4" /> Load
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {workflows && workflows.map(wf => (
                      <DropdownMenuItem key={wf.id} onClick={() => loadWorkflow(wf.id)}>
                        {wf.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel */}
        <ResizablePanel defaultSize={55}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="m-2">
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="test">Test & Execute</TabsTrigger>
            </TabsList>
            <TabsContent value="canvas" className="flex-1">
              <LabCanvas 
                workflow={workflow} 
                onWorkflowChange={handleWorkflowChange} 
                apiKey={apiKey}
                providerId={activeProvider?.providerId}
                userId={userId}
              />
            </TabsContent>
            <TabsContent value="test" className="flex-1 p-4">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>Workflow Execution</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <Button onClick={handleExecuteWorkflow} disabled={isExecuting}>
                      {isExecuting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      Execute Workflow
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Download className="mr-2 h-4 w-4" /> Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => exportAsJson(workflow)}>
                          <FileJson className="mr-2 h-4 w-4" /> JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportAsYaml(workflow)}>
                          <FileText className="mr-2 h-4 w-4" /> YAML
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportAsMarkdown(workflow)}>
                          <FileCode className="mr-2 h-4 w-4" /> Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportAsXml(workflow)}>
                          <FileX2 className="mr-2 h-4 w-4" /> XML
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <ScrollArea className="flex-1 border rounded-md p-4">
                    <pre className="text-sm whitespace-pre-wrap">
                      {chatMessages.map((msg, index) => (
                        <div key={index} className={`mb-2 p-2 rounded-md ${msg.role === 'user' ? 'bg-muted' : 'bg-primary/10'}`}>
                          <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
                        </div>
                      ))}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
          <div className="p-4 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Chat Interface</h2>
            <Card className="flex-1 flex flex-col">
              <CardContent className="flex-1 p-4">
                <ScrollArea className="h-full">
                  {/* Chat messages will be displayed here */}
                </ScrollArea>
              </CardContent>
              <div className="p-4 border-t">
                <div className="relative">
                  <Input 
                    placeholder="Chat with your workflow..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <Button size="sm" className="absolute right-1 top-1/2 -translate-y-1/2">
                    Send
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default WorkflowBuilderPage;
