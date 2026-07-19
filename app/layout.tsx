import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./phase-two.css";

export const metadata: Metadata = {
  title: "Phillies Prospect Pulse",
  description: "An intelligent, source-tracked command center for the Philadelphia Phillies farm system."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <nav className="topNav" aria-label="Main navigation">
          <div className="navInner">
            <Link className="navBrand" href="/">Prospect Pulse</Link>
            <div className="navLinks">
              <Link href="/">Command Center</Link>
              <Link href="/stats">Stats</Link>
              <Link href="/affiliates">Affiliates</Link>
              <Link href="/news">News</Link>
              <Link href="/reports">Reports</Link>
              <Link href="/compare">Compare</Link>
              <Link href="/offseason">Offseason</Link>
              <Link href="/ask">Ask Pulse</Link>
              <Link href="/rumors">Rumors</Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
