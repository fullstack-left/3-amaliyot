/// <reference path="../deno.d.ts" />
/**
 * Supabase Edge Function entry point (Deno).
 * Deploy:  npm run build:edge && supabase functions deploy submit-run
 * The platform injects SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createHandler } from './handler.ts';

const env = {
  url: Deno.env.get('SUPABASE_URL') ?? '',
  anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
};

if (!env.url || !env.anonKey || !env.serviceKey) {
  console.error('submit-run: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY missing');
}

Deno.serve(createHandler(env));
