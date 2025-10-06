/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

// Base capability types
export type ProviderCapability =
  | 'vision'
  | 'toolCalling'
  | 'streaming'
  | 'embedding'
  | 'imageGeneration'
  | 'supportsSystemMessages'
  | 'supportsParallelTools';

export type ModelType = 'chat' | 'fast' | 'embedding' | 'image' | 'legacy';

// Pricing types
export interface ModelPricing {
  input: number;
  output: number;
}

export interface ProviderPricing {
  currency: string;
  perMillionTokens: Record<string, ModelPricing>;
}

// Endpoint types
export interface ProviderEndpoints {
  chat?: string;
  embedding?: string;
  image?: string;
}

// Capability types
export interface ProviderCapabilities {
  vision: boolean;
  toolCalling: boolean;
  streaming: boolean;
  embedding: boolean;
  imageGeneration: boolean;
  maxContext: number;
  supportsSystemMessages: boolean;
  supportsParallelTools: boolean;
}

// Default models types
export interface DefaultModels {
  chat?: string;
  fast?: string;
  embedding?: string;
  image?: string;
  legacy?: string;
}

// Capability definition types
export interface CapabilityDefinition {
  name: string;
  description: string;
}

// Main provider type
export interface Provider {
  id: string;
  name: string;
  description: string;
  envKey: string;
  package: string;
  defaultModels: DefaultModels;
  capabilities: ProviderCapabilities;
  pricing?: ProviderPricing;
  endpoints: ProviderEndpoints;
  additionalEnvVars?: string[];
}

// Registry types
export interface ProviderRegistry {
  version: string;
  lastUpdated?: string;
  providers: Record<string, Provider>;
  capabilityDefinitions: Record<string, CapabilityDefinition>;
}

// Zod schemas for runtime validation
const ModelPricingSchema = z.object({
  input: z.number().min(0),
  output: z.number().min(0),
});

const ProviderPricingSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  perMillionTokens: z.record(
    z.string().regex(/^[a-zA-Z0-9._/-]+$/),
    ModelPricingSchema,
  ),
});

const ProviderEndpointsSchema = z
  .object({
    chat: z.string().min(1).optional(),
    embedding: z.string().min(1).optional(),
    image: z.string().min(1).optional(),
  })
  .refine((endpoints) => Object.keys(endpoints).length > 0, {
    message: 'At least one endpoint must be defined',
  });

const ProviderCapabilitiesSchema = z.object({
  vision: z.boolean(),
  toolCalling: z.boolean(),
  streaming: z.boolean(),
  embedding: z.boolean(),
  imageGeneration: z.boolean(),
  maxContext: z.number().min(1),
  supportsSystemMessages: z.boolean(),
  supportsParallelTools: z.boolean(),
});

const DefaultModelsSchema = z
  .object({
    chat: z.string().min(1).optional(),
    fast: z.string().min(1).optional(),
    embedding: z.string().min(1).optional(),
    image: z.string().min(1).optional(),
    legacy: z.string().min(1).optional(),
  })
  .refine((models) => Object.keys(models).length > 0, {
    message: 'At least one default model must be defined',
  });

const CapabilityDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const ProviderSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  envKey: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  package: z.string().regex(/^@pk-code\/[a-z][a-z0-9-]*$/),
  defaultModels: DefaultModelsSchema,
  capabilities: ProviderCapabilitiesSchema,
  pricing: ProviderPricingSchema.optional(),
  endpoints: ProviderEndpointsSchema,
  additionalEnvVars: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)).optional(),
});

export const ProviderRegistrySchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  lastUpdated: z.string().datetime().optional(),
  providers: z.record(ProviderSchema),
  capabilityDefinitions: z.record(CapabilityDefinitionSchema),
});

// Type guards
export function isValidProvider(obj: unknown): obj is Provider {
  return ProviderSchema.safeParse(obj).success;
}

export function isValidProviderRegistry(obj: unknown): obj is ProviderRegistry {
  return ProviderRegistrySchema.safeParse(obj).success;
}

// Utility types for filtering
export type ProviderFilter = {
  capability?: ProviderCapability;
  hasPricing?: boolean;
  supportsModelType?: ModelType;
  minContextSize?: number;
};

export type ModelSelectionCriteria = {
  capability?: ProviderCapability;
  modelType?: ModelType;
  preferCheapest?: boolean;
  minContextSize?: number;
  excludeProviders?: string[];
};
