import { router, publicProcedure } from '../trpc';
import { aiProviderSchema, testNodeSchema } from '../schemas/ai';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default provider configurations
const defaultProviders = [
  {
    providerId: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
    isActive: true,
    headers: {},
  },
  {
    providerId: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-70b'],
    isActive: false,
    headers: {
      'HTTP-Referer': 'https://semantic-canvas.app',
      'X-Title': 'Semantic Canvas',
    },
  },
  {
    providerId: 'venice',
    name: 'Venice AI',
    baseURL: 'https://api.venice.ai/api/v1',
    models: ['venice-uncensored', 'qwen-2.5-qwq-32b', 'mistral-31-24b', 'qwen3-235b', 'llama-3.2-3b', 'llama-3.1-405b', 'qwen-2.5-coder-32b', 'deepseek-r1-671b'],
    isActive: false,
    headers: {},
  },
];

export const providerRouter = router({
  // Get user's provider configuration, or create if it doesn't exist
  getConfig: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      let userProviders = await prisma.providerConfig.findMany({ where: { userId: input.userId } });
      if (userProviders.length === 0) {
        // Create default providers for the user
        const providersToCreate = defaultProviders.map(p => ({
          ...p,
          userId: input.userId,
          models: { models: p.models },
          headers: p.headers,
        }));
        await prisma.providerConfig.createMany({ data: providersToCreate });
        userProviders = await prisma.providerConfig.findMany({ where: { userId: input.userId } });
      }
      return userProviders.map((p: any) => ({...p, models: (p.models as any).models, headers: p.headers as any}));
    }),

          // Update provider configuration (NO API KEYS - BYOK Model)
  updateConfig: publicProcedure
    .input(z.object({
      userId: z.string(),
      configs: z.array(aiProviderSchema.omit({ userId: true })),
    }))
    .mutation(async ({ ctx, input }) => {
      const upserts = input.configs.map(p => {
        return prisma.providerConfig.upsert({
          where: { userId_providerId: { userId: input.userId, providerId: p.providerId } },
          update: {
            name: p.name,
            baseURL: p.baseURL,
            models: { models: p.models },
            isActive: p.isActive,
            headers: p.headers,
          },
          create: {
            userId: input.userId,
            providerId: p.providerId,
            name: p.name,
            baseURL: p.baseURL,
            models: { models: p.models },
            isActive: p.isActive,
            headers: p.headers,
          },
        });
      });
      await Promise.all(upserts);
      return { success: true };
    }),

  // Test a single node with specific provider (BYOK Model)
  testNode: publicProcedure
    .input(testNodeSchema.extend({
      userId: z.string(),
      apiKey: z.string(), // API key provided by client
    }))
    .mutation(async ({ ctx, input }) => {
      // Get provider configuration (without API key)
      const provider = await prisma.providerConfig.findFirst({
        where: { providerId: input.providerId, userId: input.userId },
      });
      
      if (!provider) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Provider not configured' });
      }

      // Use API key from client request
      const response = await fetch(`${provider.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${input.apiKey}`, // Use client-provided API key
          ...((provider.headers as any) || {}),
        },
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: 'system', content: `You are processing a semantic workflow node of type: ${input.nodeType}.` },
            { role: 'user', content: input.content },
          ],
          ...input.parameters,
        }),
      });

      if (!response.ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Provider API error: ${response.statusText}` });
      }

      const result = await response.json();
      return {
        nodeId: input.nodeId,
        result: (result as any).choices[0].message.content,
        usage: (result as any).usage,
        model: input.model,
        provider: provider.name,
      };
    }),
});
