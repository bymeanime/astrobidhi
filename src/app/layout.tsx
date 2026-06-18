import type { Metadata } from "next";
import localFont from "next/font/local";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Use local font fallback to avoid network dependency on Google Fonts CDN
// In production with internet access, you can switch back to next/font/google
const geistSans = localFont({
  variable: "--font-geist-sans",
  src: [
    { path: '../../node_modules/@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/geist-sans/files/geist-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [
    { path: '../../node_modules/@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/geist-mono/files/geist-mono-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
});

export const metadata: Metadata = {
  title: "AstroBidhi - Vedic Astrology Wisdom",
  description: "Discover your cosmic blueprint with KP Vedic Astrology. Generate birth charts, Vimshottari Dasa timelines, planetary aspects, and more powered by the ancient wisdom of Jyotish.",
  keywords: ["Vedic Astrology", "KP Astrology", "Jyotish", "Birth Chart", "Horoscope", "Vimshottari Dasa", "Nakshatra", "Planetary Aspects"],
  authors: [{ name: "AstroBidhi" }],
  icons: {
    icon: "/logo.svg",
  },
  verification: {
    google: "-q3W2fumD9-M0UeCyMQhegn7V_d8S6vYGDhad6H8BCc",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-temple-bg text-foreground`}
      >
        {children}
        <Toaster />
        <GoogleAnalytics gaId="G-EDWDQSBVCR" />
      </body>
    </html>
  );
}
