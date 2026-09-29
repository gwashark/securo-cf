import type { D1Database, RuntimeEnv } from './runtime'

const PBKDF2_ITERATIONS = 100_000
const TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60

function encode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index]
  return result === 0
}

async function derivePassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePassword(password, salt)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${encode(salt)}$${encode(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterations, encodedSalt, encodedHash] = stored.split('$')
  if (algorithm !== 'pbkdf2' || Number(iterations) !== PBKDF2_ITERATIONS || !encodedSalt || !encodedHash) return false
  const actual = await derivePassword(password, decode(encodedSalt))
  return constantTimeEqual(actual, decode(encodedHash))
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return encode(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))))
}

function secretFor(env: RuntimeEnv): string {
  const secret = env.JWT_SECRET || env.SECRET_KEY
  if (!secret) throw new Error('JWT_SECRET or SECRET_KEY must be configured')
  return secret
}

export async function issueToken(userId: string, env: RuntimeEnv): Promise<string> {
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = encode(JSON.stringify({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }))
  const value = `${header}.${payload}`
  return `${value}.${await sign(value, secretFor(env))}`
}

export async function readToken(token: string | null, env: RuntimeEnv): Promise<string | null> {
  if (!token) return null
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return null
  const expected = await sign(`${header}.${payload}`, secretFor(env))
  if (!constantTimeEqual(new TextEncoder().encode(signature), new TextEncoder().encode(expected))) return null
  try {
    const claims = JSON.parse(new TextDecoder().decode(decode(payload))) as { sub?: string; exp?: number }
    return claims.sub && claims.exp && claims.exp > Math.floor(Date.now() / 1000) ? claims.sub : null
  } catch {
    return null
  }
}

export async function authenticatedUserId(request: Request, env: RuntimeEnv): Promise<string | null> {
  const authorization = request.headers.get('Authorization')
  return readToken(authorization?.replace(/^Bearer\s+/i, '') ?? null, env).catch(() => null)
}

export async function requireSuperuser(request: Request, env: RuntimeEnv, db: D1Database): Promise<string> {
  const userId = await authenticatedUserId(request, env)
  if (!userId) throw new Response('Unauthorized', { status: 401 })
  const user = await db.prepare('SELECT is_superuser, is_active FROM users WHERE id = ?').bind(userId).first<{ is_superuser: number; is_active: number }>()
  if (!user?.is_active) throw new Response('Unauthorized', { status: 401 })
  if (!user.is_superuser) throw new Response('Forbidden', { status: 403 })
  return userId
}

export function userResponse(user: {
  id: string
  email: string
  preferences: string
  is_active: number
  is_superuser: number
  is_verified: number
}) {
  return {
    id: user.id,
    email: user.email,
    is_active: Boolean(user.is_active),
    is_superuser: Boolean(user.is_superuser),
    is_verified: Boolean(user.is_verified),
    is_2fa_enabled: false,
    preferences: JSON.parse(user.preferences || '{}'),
  }
}