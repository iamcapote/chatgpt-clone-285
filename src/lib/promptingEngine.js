// Enhanced AI Prompting Engine for Semantic Logic AI Workflow Builder
// Supports three prompting modes: 1) Text-to-Workflow, 2) Workflow Execution, 3) Node Enhancement

import { NODE_TYPES } from './ontology.js';
import { exportWorkflowAsJSON, exportWorkflowAsMarkdown, exportWorkflowAsYAML, exportWorkflowAsXML } from './exportUtils.js';

export class PromptingEngine {
  constructor(trpcClient, userId) {
    this.trpcClient = trpcClient;
    this.userId = userId;
  }

    // Mode 1: Text-to-Workflow Conversion
  async convertTextToWorkflow(textInput, apiKey, providerId = 'openai', model = 'gpt-4o') {
    const systemPrompt = `You are a semantic logic workflow converter. Convert the provided text into a structured workflow using our semantic node ontology.

Available Node Types:
${Object.entries(NODE_TYPES).map(([key, value]) => `- ${key}: ${value.label} (${value.description})`).join('\n')}

Instructions:
1. Analyze the text for logical components, statements, hypotheses, evidence, reasoning steps, etc.
2. Map these to appropriate semantic node types from our ontology
3. Create connections between nodes that show logical flow
4. Output ONLY valid JSON in this exact format:

{
  "nodes": [
    {
      "id": "node-1",
      "type": "semantic",
      "position": {"x": 100, "y": 100},
      "data": {
        "type": "PROP-STM",
        "label": "Main Statement",
        "content": "Extracted statement from text",
        "metadata": {
          "cluster": "PROP",
          "tags": ["extracted", "atomic"]
        }
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1-2",
      "source": "node-1",
      "target": "node-2",
      "data": {"condition": "implies"}
    }
  ]
}

Position nodes logically from left to right, top to bottom. Use appropriate semantic node types.`;

    const userPrompt = `Convert this text into a semantic workflow:\n\n${textInput}`;

    try {
      const result = await this.trpcClient.provider.testNode.mutate({
        userId: this.userId,
        nodeId: 'text-to-workflow',
        nodeType: 'TextToWorkflow',
        content: userPrompt,
        providerId: providerId,
        model: model,
        apiKey: apiKey,
        parameters: {
          temperature: 0.3,
          max_tokens: 2000,
          top_p: 0.9,
        },
      });

      // Parse the AI response to extract workflow JSON
      const workflowData = this.parseWorkflowFromAIResponse(result.result);
      return {
        success: true,
        workflow: workflowData,
        metadata: {
          originalText: textInput,
          generatedBy: `${result.provider} - ${model}`,
          tokensUsed: result.usage
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

      // Mode 2: Workflow Execution with Format Control
  async executeWorkflowWithFormat(workflow, outputFormat = 'json', executionSettings = {}) {
    const {
      temperature = 0.7,
      maxTokens = 1500,
      providerId = 'openai',
      model = 'gpt-4o',
      apiKey
    } = executionSettings;

    // First, convert workflow to selected format for structured prompting
    const structuredWorkflow = this.formatWorkflowForPrompting(workflow, outputFormat);

    const systemPrompt = `You are a semantic logic workflow executor. Execute the provided workflow step by step.

Workflow Format: ${outputFormat.toUpperCase()}
Your task:
1. Process each node in the workflow according to its semantic type
2. Follow the logical connections between nodes
3. Provide reasoning for each step
4. Return results in the same ${outputFormat} format structure

Available Node Types and Their Purposes:
${Object.entries(NODE_TYPES).map(([key, value]) => `- ${key}: ${value.label} - ${value.description}`).join('\n')}

Process the workflow systematically and provide detailed reasoning for each node.`;

    const userPrompt = `Execute this semantic workflow:\n\n${structuredWorkflow}`;

    try {
      const result = await this.trpcClient.provider.testNode.mutate({
        userId: this.userId,
        nodeId: 'workflow-execution',
        nodeType: 'WorkflowExecution',
        content: userPrompt,
        providerId: providerId,
        model: model,
        apiKey: apiKey,
        parameters: {
          temperature: temperature,
          max_tokens: maxTokens,
          top_p: 1,
        },
      });

      return {
        success: true,
        execution: {
          originalWorkflow: workflow,
          format: outputFormat,
          result: result.result,
          provider: result.provider,
          model: model,
          usage: result.usage,
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Mode 3: Individual Node Enhancement
  async enhanceNode(node, enhancementType = 'improve', context = {}) {
    const {
      temperature = 0.7,
      maxTokens = 800,
      providerId = 'openai',
      model = 'gpt-4o-mini',
      apiKey
    } = context;

    const nodeType = NODE_TYPES[node.data.type];
    if (!nodeType) {
      throw new Error(`Unknown node type: ${node.data.type}`);
    }

    const enhancementPrompts = {
      improve: `Improve and refine this semantic node while maintaining its logical purpose and type.`,
      optimize: `Optimize this semantic node for clarity, precision, and logical coherence.`,
      refactor: `Refactor this semantic node to be more structured and academically rigorous.`,
      enhance: `Enhance this semantic node with richer vocabulary and more sophisticated reasoning.`,
      simplify: `Simplify this semantic node while preserving its essential meaning and logical function.`,
      elaborate: `Elaborate on this semantic node with additional detail and nuanced reasoning.`
    };

    const systemPrompt = `You are a semantic logic node enhancer. Your task is to ${enhancementType} semantic workflow nodes.

Node Type: ${node.data.type} (${nodeType.label})
Purpose: ${nodeType.description}
Cluster: ${node.data.metadata?.cluster || 'Unknown'}

Guidelines:
1. Maintain the node's semantic type and logical purpose
2. Preserve the core meaning while improving expression
3. Use appropriate academic and technical vocabulary
4. Ensure the enhanced content fits the node's semantic category
5. Return ONLY the enhanced content, no additional formatting

Enhancement Type: ${enhancementType}`;

    const userPrompt = `${enhancementPrompts[enhancementType] || enhancementPrompts.improve}

Original Node Content:
"${node.data.content || 'No content provided'}"

Enhanced Content:`;

    try {
      const result = await this.trpcClient.provider.testNode.mutate({
        userId: this.userId,
        nodeId: node.id,
        nodeType: `${node.data.type}-Enhancement`,
        content: userPrompt,
        providerId: providerId,
        model: model,
        apiKey: apiKey,
        parameters: {
          temperature: temperature,
          max_tokens: maxTokens,
          top_p: 0.9,
        },
      });

      return {
        success: true,
        enhancement: {
          originalNode: node,
          enhancementType: enhancementType,
          originalContent: node.data.content,
          enhancedContent: result.result,
          provider: result.provider,
          model: model,
          usage: result.usage,
          enhancedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper: Format workflow for prompting
  formatWorkflowForPrompting(workflow, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return exportWorkflowAsJSON(workflow).content;
      case 'markdown':
        return exportWorkflowAsMarkdown(workflow).content;
      case 'yaml':
        return exportWorkflowAsYAML(workflow).content;
      case 'xml':
        return exportWorkflowAsXML(workflow).content;
      default:
        return exportWorkflowAsJSON(workflow).content;
    }
  }

  // Helper: Parse workflow from AI response
  parseWorkflowFromAIResponse(aiResponse) {
    try {
      // Look for JSON in the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, return a simple structure
      return {
        nodes: [],
        edges: [],
        error: 'Could not parse workflow from AI response'
      };
    } catch (error) {
      return {
        nodes: [],
        edges: [],
        error: `JSON parsing error: ${error.message}`
      };
    }
  }

  // Helper: Get available providers for prompting
  async getAvailableProviders() {
    try {
      const providers = await this.trpcClient.provider.getConfig.query({ userId: this.userId });
      return providers.filter(p => p.isActive || sessionStorage.getItem(`${p.providerId}_api_key`));
    } catch (error) {
      console.error('Failed to get providers:', error);
      return [];
    }
  }

  // Helper: Get recommended models for different prompting tasks
  getRecommendedModels(taskType) {
    const recommendations = {
      'text-to-workflow': ['gpt-4o', 'gpt-4', 'claude-3.5-sonnet'],
      'workflow-execution': ['gpt-4o', 'gpt-4', 'claude-3.5-sonnet'],
      'node-enhancement': ['gpt-4o-mini', 'gpt-4', 'claude-3.5-sonnet']
    };
    return recommendations[taskType] || recommendations['node-enhancement'];
  }
}

export default PromptingEngine;
