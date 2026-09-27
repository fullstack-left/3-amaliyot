/**
 * Minimal Supabase REST client (no supabase-js — zero dependencies).
 *
 * Endpoints (same wire format supabase-js / auth-js uses):
 *   Auth (GoTrue)   POST /auth/v1/signup                        anonymous sign-in: { data: {}, gotrue_meta_security }
 *                   POST /auth/v1/signup                        email + password sign-up
 *                   POST /auth/v1/token?grant_type=password      sign-in
 *                   POST /auth/v1/token?grant_type=refresh_token refresh
 *                   GET  /auth/v1/user                          current user
 *   PostgREST       GET  /rest/v1/<table>?<query>
 *                   POST /rest/v1/rpc/<fn>
 *   Functions       POST /functions/v1/<name>
 * Every request carries `apikey: <anon key>`; authenticated ones add
 * `Authorization: Bearer <access_token>`.
 */

import type { CloudSession } from '../save.js';

export class SupaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'SupaError';
  }
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

interface GoTrueSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: { id: string; email?: string | null };
}

function toSession(raw: GoTrueSession): CloudSession {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt: raw.expires_at ?? Math.floor(Date.now() / 1000) + (raw.expires_in ?? 3600),
    userId: raw.user.id,
    email: raw.user.email ?? null,
  };
}

export class SupaClient {
  session: CloudSession | null;
  private readonly url: string;

  constructor(
    url: string,
    private readonly anonKey: string,
    session: CloudSession | null = null,
    private readonly fetchFn: FetchFn = (i, init) => fetch(i, init),
  ) {
    this.url = url.replace(/\/+$/, '');
    this.session = session;
  }

  static validUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, auth = true, extra: Record<string, string> = {}): Promise<T> {
    const headers: Record<string, string> = { apikey: this.anonKey, 'Content-Type': 'application/json', ...extra };
    if (auth && this.session) headers.Authorization = `Bearer ${this.session.accessToken}`;
    let res: Response;
    try {
      res = await this.fetchFn(`${this.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new SupaError(`Tarmoq xatosi: ${(e as Error).message}`, 0, 'network');
    }
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const d = (data ?? {}) as Record<string, unknown>;
      const msg = String(d.msg ?? d.message ?? d.error_description ?? d.error ?? `HTTP ${res.status}`);
      throw new SupaError(msg, res.status, typeof d.code === 'string' ? d.code : typeof d.error_code === 'string' ? d.error_code : undefined);
    }
    return data as T;
  }

  // ---- auth ----------------------------------------------------------------
  async signInAnonymously(): Promise<CloudSession> {
    const raw = await this.request<GoTrueSession>('POST', '/auth/v1/signup', { data: {}, gotrue_meta_security: {} }, false);
    this.session = toSession(raw);
    return this.session;
  }

  /** Returns null when the project requires e-mail confirmation first. */
  async signUp(email: string, password: string): Promise<CloudSession | null> {
    const raw = await this.request<GoTrueSession | { id: string }>('POST', '/auth/v1/signup', { email, password }, false);
    if ('access_token' in raw) {
      this.session = toSession(raw);
      return this.session;
    }
    return null;
  }

  async signIn(email: string, password: string): Promise<CloudSession> {
    const raw = await this.request<GoTrueSession>('POST', '/auth/v1/token?grant_type=password', { email, password }, false);
    this.session = toSession(raw);
    return this.session;
  }

  async refresh(): Promise<CloudSession> {
    if (!this.session) throw new SupaError('Sessiya yo‘q', 401);
    const raw = await this.request<GoTrueSession>('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: this.session.refreshToken }, false);
    this.session = toSession(raw);
    return this.session;
  }

  /** Refresh the access token if it expires within a minute; sign in anonymously if there is no session. */
  async ensureSession(): Promise<CloudSession> {
    if (!this.session) return this.signInAnonymously();
    if (this.session.expiresAt - 60 < Date.now() / 1000) return this.refresh();
    return this.session;
  }

  signOut(): void {
    this.session = null;
  }

  // ---- data ----------------------------------------------------------------
  select<T>(table: string, query: string): Promise<T[]> {
    return this.request<T[]>('GET', `/rest/v1/${table}?${query}`);
  }

  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', `/rest/v1/rpc/${fn}`, args);
  }

  invoke<T>(fn: string, body: unknown): Promise<T> {
    return this.request<T>('POST', `/functions/v1/${fn}`, body);
  }
}
