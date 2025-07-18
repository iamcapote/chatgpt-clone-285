import React, { useCallback, useRef, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import SemanticNode from "./SemanticNode";
import WorkflowExecutionModal from "./WorkflowExecutionModal";
import { createNode, createEdge, generateId } from "@/lib/graphSchema";
import { NODE_TYPES, CLUSTER_COLORS } from "@/lib/ontology";
import { trpc } from "@/lib/trpc";
import { Save, Download, Upload, Play, RotateCcw, FileJson, FileText, FileCode, FileX2 } from "lucide-react";
import { exportWorkflow } from "@/lib/exportUtils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Custom node types for React Flow
const nodeTypes = {
  semantic: SemanticNode,
};

const LabCanvas = ({ 
  workflow, 
  onWorkflowChange,
  userId,
}) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || []);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const { toast } = useToast();
  
  // tRPC mutations
  const createWorkflowMutation = trpc.workflow.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Workflow Created",
        description: `Workflow "${data.title}" has been saved to the database.`,
      });
    },
    onError: (error) => {
      console.error('Failed to create workflow:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save workflow to database. Saved locally instead.",
        variant: "destructive",
      });
    },
  });
  
  const updateWorkflowMutation = trpc.workflow.update.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Workflow Updated",
        description: `Workflow "${data.title}" has been updated.`,
      });
    },
    onError: (error) => {
      console.error('Failed to update workflow:', error);
      toast({
        title: "Update Failed", 
        description: "Failed to update workflow in database. Saved locally instead.",
        variant: "destructive",
      });
    },
  });
  
  // Update parent workflow when nodes/edges change
  React.useEffect(() => {
    if (onWorkflowChange) {
      onWorkflowChange({
        ...workflow,
        nodes,
        edges,
        metadata: {
          ...workflow?.metadata,
          updatedAt: new Date().toISOString()
        }
      });
    }
  }, [nodes, edges]);
  
  const onConnect = useCallback(
    (params) => {
      const newEdge = createEdge(params.source, params.target);
      setEdges((eds) => addEdge({ ...params, ...newEdge }, eds));
    },
    [setEdges]
  );
  
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const nodeType = event.dataTransfer.getData('application/reactflow');
      
      if (!nodeType || !reactFlowInstance) {
        return;
      }
      
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      
      const newNode = createNode(nodeType, position);
      newNode.type = 'semantic'; // React Flow node type
      newNode.data.type = nodeType; // Our semantic type
      
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );
  
  const onSaveWorkflow = useCallback(async () => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      const workflowData = {
        ...workflow,
        nodes: flow.nodes,
        edges: flow.edges,
        viewport: flow.viewport,
        metadata: {
          ...workflow.metadata,
          updatedAt: new Date().toISOString(),
        }
      };
      
      try {
        if (workflow?.metadata?.id) {
          // Update existing workflow
          await updateWorkflowMutation.mutateAsync({
            id: workflow.metadata.id,
            data: {
              title: workflow.metadata?.title || 'Untitled Workflow',
              description: workflow.metadata?.description,
              content: {
                nodes: flow.nodes,
                edges: flow.edges,
                viewport: flow.viewport,
              },
              version: (workflow.metadata.version || 0) + 1,
            }
          });
        } else {
          // Create new workflow
          await createWorkflowMutation.mutateAsync({
            userId: userId,
            title: workflow.metadata?.title || 'Untitled Workflow',
            description: workflow.metadata?.description,
            content: {
              nodes: flow.nodes,
              edges: flow.edges,
              viewport: flow.viewport,
            }
          });
        }
        onWorkflowChange(workflowData); // Update parent state
      } catch (error) {
        // Error is handled by mutation's onError callback
        // We still save locally
        localStorage.setItem(`current-workflow-${userId}`, JSON.stringify(workflowData));
      }
    }
  }, [reactFlowInstance, workflow, onWorkflowChange, updateWorkflowMutation, createWorkflowMutation, userId]);
  
  const onExportWorkflow = (format) => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      const workflowData = {
        ...workflow,
        nodes: flow.nodes,
        edges: flow.edges,
        viewport: flow.viewport
      };
      
      const dataStr = JSON.stringify(workflowData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `workflow-${workflow?.metadata?.title || 'untitled'}-${Date.now()}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  }, [reactFlowInstance, workflow]);
  
  const onResetCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  const handleExport = useCallback((format) => {
    if (!workflow) return;
    
    try {
      const exportData = exportWorkflow(workflow, format);
      const blob = new Blob([exportData.content], { type: exportData.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: `Workflow exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [workflow, toast]);
  
  // Stats for the panel
  const stats = useMemo(() => {
    const nodesByCluster = nodes.reduce((acc, node) => {
      const cluster = node.data?.metadata?.cluster || 'unknown';
      acc[cluster] = (acc[cluster] || 0) + 1;
      return acc;
    }, {});
    
    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      clusters: nodesByCluster
    };
  }, [nodes, edges]);
  
  const onNodeUpdate = (nodeId, data) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      })
    );
  };

  const onNodeEnhance = async (nodeId, enhancementType) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // This is where you would call your prompting engine
    // For now, we'll just simulate an update
    toast({
      title: "Enhancement Requested",
      description: `Requesting AI to ${enhancementType} for node: ${node.data.label}.`,
    });

    // Example of how you might update the node after AI processing
    setTimeout(() => {
      onNodeUpdate(nodeId, { 
        content: `${node.data.content}\n\n[AI Enhanced: ${enhancementType} at ${new Date().toLocaleTimeString()}]`
      });
      toast({
        title: "Node Enhanced",
        description: `Node ${node.data.label} has been updated.`,
      });
    }, 2000);
  };

  const memoizedNodeTypes = useMemo(() => ({
    semantic: (props) => <SemanticNode {...props} onUpdate={onNodeUpdate} onEnhance={onNodeEnhance} />
  }), [onNodeUpdate, onNodeEnhance]);

  return (
    <div className="h-full w-full" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={memoizedNodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
        <Panel position="top-right">
          <div className="flex gap-2">
            <Button onClick={onSaveWorkflow} variant="outline" size="sm">
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onExportWorkflow('json')}>
                  <FileJson className="mr-2 h-4 w-4" /> JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportWorkflow('yaml')}>
                  <FileText className="mr-2 h-4 w-4" /> YAML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportWorkflow('markdown')}>
                  <FileCode className="mr-2 h-4 w-4" /> Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportWorkflow('xml')}>
                  <FileX2 className="mr-2 h-4 w-4" /> XML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

// Wrapper component with ReactFlowProvider
const LabCanvasWrapper = (props) => {
  return (
    <ReactFlowProvider>
      <LabCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default LabCanvasWrapper;
