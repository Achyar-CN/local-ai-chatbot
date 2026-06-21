"use client";

// Casual app lock for local privacy. A salted SHA-256 of the PIN is kept in
// localStorage and a session flag marks the tab unlocked. This deters a glance
// over your shoulder; it is not disk encryption.

const PIN_KEY = "atlas.pinHash";
const SESSION_KEY = "atlas.unlocked";

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`atlas:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isLockEnabled(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem(PIN_KEY);
}

export function isUnlocked(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1";
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, await hashPin(pin));
  sessionStorage.setItem(SESSION_KEY, "1");
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_KEY);
  return !!stored && stored === (await hashPin(pin));
}

export function markUnlocked(): void {
  sessionStorage.setItem(SESSION_KEY, "1");
}

export function lockNow(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function removePin(pin: string): Promise<boolean> {
  if (!(await verifyPin(pin))) return false;
  localStorage.removeItem(PIN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  return true;
}
