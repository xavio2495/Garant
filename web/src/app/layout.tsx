import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });

const description = "Fully funded guarantees on exchange rates and weather, settled on Monad.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: "Garant",
  description,
  openGraph: {
    title: "Garant: a floor under the things you can't control",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Garant: a rate line dipping below a guaranteed floor" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#f6f7f4" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${hanken.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
