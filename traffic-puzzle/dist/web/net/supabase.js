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
export class SupaError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'SupaError';
    }
}
function toSession(raw) {
    return {
        accessToken: raw.access_token,
        refreshToken: raw.refresh_token,
        expiresAt: raw.expires_at ?? Math.floor(Date.now() / 1000) + (raw.expires_in ?? 3600),
        userId: raw.user.id,
        email: raw.user.email ?? null,
    };
}
export class SupaClient {
    anonKey;
    fetchFn;
    session;
    url;
    constructor(url, anonKey, session = null, fetchFn = (i, init) => fetch(i, init)) {
        this.anonKey = anonKey;
        this.fetchFn = fetchFn;
        this.url = url.replace(/\/+$/, '');
        this.session = session;
    }
    static validUrl(url) {
        try {
            const u = new URL(url);
            return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        }
        catch {
            return false;
        }
    }
    async request(method, path, body, auth = true, extra = {}) {
        const headers = { apikey: this.anonKey, 'Content-Type': 'application/json', ...extra };
        if (auth && this.session)
            headers.Authorization = `Bearer ${this.session.accessToken}`;
        let res;
        try {
            res = await this.fetchFn(`${this.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        }
        catch (e) {
            throw new SupaError(`Tarmoq xatosi: ${e.message}`, 0, 'network');
        }
        const text = await res.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            }
            catch {
                data = text;
            }
        }
        if (!res.ok) {
            const d = (data ?? {});
            const msg = String(d.msg ?? d.message ?? d.error_description ?? d.error ?? `HTTP ${res.status}`);
            throw new SupaError(msg, res.status, typeof d.code === 'string' ? d.code : typeof d.error_code === 'string' ? d.error_code : undefined);
        }
        return data;
    }
    // ---- auth ----------------------------------------------------------------
    async signInAnonymously() {
        const raw = await this.request('POST', '/auth/v1/signup', { data: {}, gotrue_meta_security: {} }, false);
        this.session = toSession(raw);
        return this.session;
    }
    /** Returns null when the project requires e-mail confirmation first. */
    async signUp(email, password) {
        const raw = await this.request('POST', '/auth/v1/signup', { email, password }, false);
        if ('access_token' in raw) {
            this.session = toSession(raw);
            return this.session;
        }
        return null;
    }
    async signIn(email, password) {
        const raw = await this.request('POST', '/auth/v1/token?grant_type=password', { email, password }, false);
        this.session = toSession(raw);
        return this.session;
    }
    async refresh() {
        if (!this.session)
            throw new SupaError('Sessiya yo‘q', 401);
        const raw = await this.request('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: this.session.refreshToken }, false);
        this.session = toSession(raw);
        return this.session;
    }
    /** Refresh the access token if it expires within a minute; sign in anonymously if there is no session. */
    async ensureSession() {
        if (!this.session)
            return this.signInAnonymously();
        if (this.session.expiresAt - 60 < Date.now() / 1000)
            return this.refresh();
        return this.session;
    }
    signOut() {
        this.session = null;
    }
    // ---- data ----------------------------------------------------------------
    select(table, query) {
        return this.request('GET', `/rest/v1/${table}?${query}`);
    }
    rpc(fn, args) {
        return this.request('POST', `/rest/v1/rpc/${fn}`, args);
    }
    invoke(fn, body) {
        return this.request('POST', `/functions/v1/${fn}`, body);
    }
}
//# sourceMappingURL=supabase.js.map