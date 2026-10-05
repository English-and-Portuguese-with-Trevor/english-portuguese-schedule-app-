import type { Metadata } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/prefs";

// The sites' text face.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// The landing page's wordmark and heading font.
const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const description = "Book your English or Portuguese lesson with Trevor.";

export const metadata: Metadata = {
  // Link previews (WhatsApp, iMessage…) need absolute URLs for the image.
  metadataBase: new URL("https://schedule.englishandportuguesewithtrevor.com"),
  title: "English & Portuguese with Trevor — Scheduling",
  description,
  openGraph: {
    title: "English & Portuguese with Trevor",
    description,
    siteName: "English & Portuguese with Trevor",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSerifDisplay.variable} h-full antialiased`}
      // The inline script below may set data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* Dark mode from the shared ept-prefs cookie, before first paint (keeps pages static). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
