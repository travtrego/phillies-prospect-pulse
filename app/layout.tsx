import type { Metadata } from "next";
import "./globals.css";
import "./phase-two.css";
import "./ask.css";
import "./movement.css";
import "./product.css";
import SiteNavigation from "./SiteNavigation";

export const metadata: Metadata = {
  metadataBase: new URL("https://phillies-prospect-pulse-git-main-travis-trego.vercel.app"),
  title: "Phillies Prospect Pulse",
  description: "A focused, source-tracked view of the Philadelphia Phillies farm system."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteNavigation />
        {children}
      </body>
    </html>
  );
}
