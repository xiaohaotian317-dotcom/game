import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "秘境决斗",
  description: "六职业横版双人决斗。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
