import type { Metadata } from "next";
import "./globals.css";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from "./site";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: "Iowa From Above | Iowa’s Environmental Challenges",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  authors: [{ name: "Mustafa Hameed" }],
  creator: "Mustafa Hameed",
  publisher: "Iowa From Above",
  category: "education",
  keywords: [
    "Iowa water quality",
    "Iowa environmental issues",
    "interactive Iowa map",
    "Iowa watershed exploration",
    "Iowa education",
    "virtual field trip",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Iowa From Above | Iowa’s Environmental Challenges",
    description: SITE_DESCRIPTION,
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Iowa From Above | Iowa’s Environmental Challenges",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
