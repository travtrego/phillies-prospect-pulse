import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phillies Prospect Pulse",
  description: "A clean, source-tracked view of the Philadelphia Phillies farm system."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
