import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Certificate Generator",
  description: "Issue and view on-chain certificate NFTs (RWA)",
  applicationName: "Certificate Generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-app-name="Certificate Generator">
      <body>{children}</body>
    </html>
  );
}
