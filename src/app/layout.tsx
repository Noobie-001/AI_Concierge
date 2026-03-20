import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Event Concierge",
  description:
    "A full-stack corporate offsite planner that turns natural language briefs into structured venue proposals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
