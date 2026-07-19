import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phillies Prospect Pulse",
  description: "A clean, source-tracked view of the Philadelphia Phillies farm system."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <nav className="topNav" aria-label="Main navigation">
          <div className="navInner">
            <Link className="navBrand" href="/">Prospect Pulse</Link>
            <div className="navLinks">
              <Link href="/">Prospects</Link>
              <Link href="/news">News</Link>
              <Link href="/stats">Stats</Link>
              <Link href="/rumors">Rumors</Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
