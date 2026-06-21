"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Brandmark } from "./Brandmark";
import { verifyPin, markUnlocked } from "@/lib/lock";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verifyPin(pin)) {
      markUnlocked();
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-bg">
      <form onSubmit={submit} className="flex w-72 flex-col items-center gap-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-fg glow-accent">
          <Brandmark className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Atlas is locked</h1>
          <p className="mt-1 text-xs text-muted">Enter your PIN to continue.</p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder="PIN"
          className={`w-full rounded-xl border bg-surface px-4 py-2.5 text-center text-lg tracking-[0.3em] text-foreground outline-none transition-colors ${
            error ? "border-destructive" : "border-border focus:border-accent/60"
          }`}
        />
        {error && <p className="text-xs text-destructive">Incorrect PIN. Try again.</p>}
        <button
          type="submit"
          className="press flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-fg cursor-pointer"
        >
          <Lock className="h-4 w-4" /> Unlock
        </button>
      </form>
    </div>
  );
}
