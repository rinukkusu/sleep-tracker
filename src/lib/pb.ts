import PocketBase from 'pocketbase';

const URL_KEY = 'pb_url';

export function defaultServerUrl(): string {
  return localStorage.getItem(URL_KEY) || import.meta.env.VITE_PB_URL || location.origin;
}

export const pb = new PocketBase(defaultServerUrl());
pb.autoCancellation(false);

export function setServerUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  localStorage.setItem(URL_KEY, clean);
  pb.baseURL = clean;
}

/** PocketBase-compatible record id: 15 chars of [a-z0-9]. Generated client-side so offline creates work. */
export function newId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
