import { AccountButton } from "@/components/account-button";
import { AppTabs } from "@/components/app/app-tabs";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

// The app shares the site's nav and footer; between them, the three rooms as tabs and the page itself
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav extra={<AccountButton className="px-3 py-2 sm:px-4" />} />
      <div className="mx-auto max-w-6xl px-5 pt-4 sm:px-8 lg:px-10">
        <AppTabs />
      </div>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 lg:px-10">{children}</main>
      <SiteFooter />
    </>
  );
}
