import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Silkscreen } from "next/font/google";
import { PixelField } from "@/components/pixel-field";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Inter_Tight({ variable: "--font-display-face", subsets: ["latin"] });
const pixel = Silkscreen({ variable: "--font-pixel-face", subsets: ["latin"], weight: ["400", "700"] });

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

export const viewport: Viewport = { themeColor: "#050505" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} ${pixel.variable}`}>
      <body className="isolate min-h-dvh">
        <PixelField />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
