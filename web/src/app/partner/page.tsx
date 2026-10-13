import type { Metadata } from "next";
import { SendForm } from "./send-form";

export const metadata: Metadata = { title: "Hatid · Send money home" };

export default function PartnerPage() {
  return (
    <div className="min-h-dvh sm:py-10">
      <p className="hidden pb-4 text-center text-xs uppercase tracking-[0.22em] text-muted sm:block">
        A partner&apos;s app, adding a Garant guarantee through one API call
      </p>
      <div className="glass mx-auto min-h-dvh max-w-md sm:min-h-0">
        <header className="flex items-center justify-between px-6 pb-2 pt-6">
          <span className="font-display text-2xl font-semibold tracking-tight">hatid</span>
          <span className="bg-garant-soft px-3 py-1 text-xs text-garant">Demo partner app</span>
        </header>
        <SendForm />
      </div>
    </div>
  );
}
