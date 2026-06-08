import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AstroBidhi - Vedic Astrology Wisdom",
  description: "Discover your cosmic blueprint with KP Vedic Astrology. Generate birth charts, Vimshottari Dasa timelines, planetary aspects, and more powered by the ancient wisdom of Jyotish.",
  keywords: ["Vedic Astrology", "KP Astrology", "Jyotish", "Birth Chart", "Horoscope", "Vimshottari Dasa", "Nakshatra", "Planetary Aspects"],
  authors: [{ name: "AstroBidhi" }],
  icons: {
    icon: "/logo.svg",
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
