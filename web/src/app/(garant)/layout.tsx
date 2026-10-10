import { SiteHeader } from "@/components/site-header";

export default function GarantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-10">{children}</main>
      <footer className="mx-auto max-w-5xl px-5 pb-10 text-sm text-muted">
        Running on Monad testnet. Not live with real money until audited.
      </footer>
    </>
  );
}
