import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/bricolage-grotesque/standard.css";
import "@fontsource-variable/martian-mono/wght.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "3-Stunden-Build",
  description: "Ein Abend, ein Thema, drei Stunden.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#07080a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="stage flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
