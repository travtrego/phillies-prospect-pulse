import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./phase-two.css";
import "./ask.css";
import "./movement.css";

export const metadata: Metadata = {
  title: "Phillies Prospect Pulse",
  description: "A focused, source-tracked view of the Philadelphia Phillies farm system."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <nav className="topNav" aria-label="Main navigation">
          <div className="navInner">
            <Link className="navBrand" href="/">Prospect Pulse</Link>
            <div className="navLinks">
              <Link href="/">Home</Link>
              <Link href="/prospect-genie">Prospect Genie</Link>
              <Link href="/affiliates">Affiliates</Link>
              <Link href="/news">News</Link>
              <Link href="/promotions">Promotions</Link>
              <Link href="/injuries">Injuries</Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
