import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { PixelField } from "@/components/pixel-field";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Geist({ variable: "--font-sans-face", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono-face", subsets: ["latin"] });
// Moonhouse (1001Fonts, free for commercial use, embedded unmodified) is the Garant wordmark only
const title = localFont({ src: "./fonts/Moonhouse.woff2", variable: "--font-title-face", display: "swap" });

const description = "Fully funded guarantees on exchange rates and weather, settled on Monad.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: "Garant",
  description,
  openGraph: {
    title: "Garant: a floor under the things you can't control",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Garant: pixel rain piling into a bell curve over the wordmark, on a floor" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#030304" };

// Set before first paint so motion-owned elements start hidden instead of flashing
const MOTION_FLAG = `document.documentElement.dataset.motion=matchMedia("(prefers-reduced-motion: reduce)").matches?"off":"on"`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${title.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_FLAG }} />
      </head>
      <body className="isolate min-h-dvh">
        <PixelField />
        <MotionProvider />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
