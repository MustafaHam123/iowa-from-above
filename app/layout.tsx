import type { Metadata } from "next";
import "./globals.css";

const siteHost =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(
    siteHost.startsWith("http") ? siteHost : `https://${siteHost}`,
  ),
  title: "Iowa From Above",
  description:
    "Take to the skies and explore Iowa's landmarks, communities, and stories.",
  openGraph: {
    title: "Iowa From Above",
    description:
      "Take to the skies and explore Iowa's landmarks, communities, and stories.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Iowa From Above",
    description:
      "Take to the skies and explore Iowa's landmarks, communities, and stories.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
