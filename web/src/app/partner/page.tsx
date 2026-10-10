import type { Metadata } from "next";
import { SendForm } from "./send-form";

export const metadata: Metadata = { title: "Hatid · Send money home" };

export default function PartnerPage() {
  return (
    <div className="min-h-dvh bg-[#eef2ef] sm:py-10">
      <div className="mx-auto min-h-dvh max-w-md bg-paper sm:min-h-0 sm:rounded-[2rem] sm:shadow-[0_30px_60px_-30px_rgba(19,36,31,0.35)]">
        <header className="flex items-center justify-between px-6 pb-2 pt-6">
          <span className="font-display text-2xl font-semibold tracking-tight">hatid</span>
          <span className="rounded-full bg-garant-soft px-3 py-1 text-xs text-garant">Demo partner app</span>
        </header>
        <SendForm />
      </div>
    </div>
  );
}
