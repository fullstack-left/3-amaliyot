/**
 * Hash routing (pure): URL hash ⇄ Route. Wired in main.ts so the browser back
 * button, reloads and shared links all land on the right screen.
 *
 *   #/                     menu          #/play/12              campaign level
 *   #/levels  #/garage     …             #/daily[/YYYY-MM-DD]    daily challenge
 *   #/stats   #/achievements             #/endless/<variant>    endless mode
 *                                        #/custom/<code>        shared level
 */

import { dayIndexOf } from '../content/daily.js';
import { ENDLESS_VARIANTS, type EndlessVariant } from '../content/endless.js';

export type SimpleScreen = 'menu' | 'levels' | 'garage' | 'settings' | 'rules' | 'editor' | 'stats' | 'achievements';

export const SIMPLE_SCREENS: readonly SimpleScreen[] = ['menu', 'levels', 'garage', 'settings', 'rules', 'editor', 'stats', 'achievements'];

export type Route =
  | { readonly screen: SimpleScreen }
  | { readonly screen: 'play'; readonly kind: 'campaign'; readonly id: number }
  | { readonly screen: 'play'; readonly kind: 'daily'; readonly day: string | null }
  | { readonly screen: 'play'; readonly kind: 'endless'; readonly variant: EndlessVariant }
  | { readonly screen: 'play'; readonly kind: 'custom'; readonly code: string };

const MENU: Route = { screen: 'menu' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!path) return MENU;
  const [head, arg, ...rest] = path.split('/');
  if (rest.length) return MENU;
  if ((SIMPLE_SCREENS as readonly string[]).includes(head) && arg === undefined) return { screen: head as SimpleScreen };
  switch (head) {
    case 'play': {
      const id = Number(arg);
      return Number.isInteger(id) && id >= 1 && id <= 1000 && String(id) === arg ? { screen: 'play', kind: 'campaign', id } : MENU;
    }
    case 'daily':
      if (arg === undefined) return { screen: 'play', kind: 'daily', day: null };
      return Number.isNaN(dayIndexOf(arg)) ? MENU : { screen: 'play', kind: 'daily', day: arg };
    case 'endless':
      return (ENDLESS_VARIANTS as readonly string[]).includes(arg ?? '') ? { screen: 'play', kind: 'endless', variant: arg as EndlessVariant } : MENU;
    case 'custom':
      return arg && /^L\d+\.[A-Za-z0-9_-]+$/.test(arg) ? { screen: 'play', kind: 'custom', code: arg } : MENU;
    default:
      return MENU;
  }
}

export function routeHash(route: Route): string {
  if (route.screen !== 'play') return route.screen === 'menu' ? '#/' : `#/${route.screen}`;
  switch (route.kind) {
    case 'campaign':
      return `#/play/${route.id}`;
    case 'daily':
      return route.day ? `#/daily/${route.day}` : '#/daily';
    case 'endless':
      return `#/endless/${route.variant}`;
    case 'custom':
      return `#/custom/${route.code}`;
  }
}
