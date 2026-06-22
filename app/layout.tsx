import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UNO — Browser Card Game",
  description: "Play the classic UNO card game in your browser. Full rules, AI opponent, color picker, and win detection.",
  keywords: ["UNO", "card game", "browser game"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
