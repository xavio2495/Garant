"use client";

import { useAuth } from "@/components/providers";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function AccountButton({ className = "" }: { className?: string }) {
  const auth = useAuth();
  if (!auth.enabled) return <span className="hidden max-w-[9rem] text-right font-mono text-[0.65rem] normal-case leading-tight tracking-normal text-muted sm:block">Install a browser wallet to sign in</span>;
  return auth.signedIn ? (
    <button onClick={auth.signOut} className={`btn btn-glass ${className}`}>
      {auth.address ? short(auth.address) : "Signed in"} · Out
    </button>
  ) : (
    <button onClick={auth.signIn} disabled={!auth.ready} className={`btn btn-glass ${className}`}>
      Sign in
    </button>
  );
}
