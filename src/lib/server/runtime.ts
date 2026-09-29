import { env } from 'cloudflare:workers'

export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export interface D1Database {
  prepare(query: string): D1Statement
}

export type RuntimeEnv = {
  AGENTS_ENABLED?: string
  TESOURO_DIRETO_ENABLED?: string
  JWT_SECRET?: string
  SECRET_KEY?: string
  DB?: D1Database
  MOCK_BANK_PROVIDER?: string
}

export function getRuntimeEnv(locals: App.Locals): RuntimeEnv {
  void locals
  return env as RuntimeEnv
}

export function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '')
}

export function requireDatabase(env: RuntimeEnv): D1Database {
  if (!env.DB) {
    throw new Error('The DB Cloudflare D1 binding is not configured')
  }
  return env.DB
}