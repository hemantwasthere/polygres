import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polygres Synapse",
  description: "A Polygres-ready personal knowledge graph for agent memory."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
