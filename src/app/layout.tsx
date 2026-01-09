import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Architects_Daughter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});
const architectsDaughter = Architects_Daughter({
  subsets: ["latin"],
  variable: "--font-hand",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Zuckies | Mentorship Onboarding",
  description:
    "Free software engineering mentorship by Michael Perry Tettey (Sidequest CEO x Okponglo Mark Zuckerberg). Real structure. No hand-holding. Effort is the price of entry.",
  keywords: [
    "zuckies",
    "mentorship",
    "software engineering",
    "coding",
    "developer",
    "programming",
    "free mentorship",
    "sidequest ceo",
    "michael perry tettey",
    "okponglo zuck",
  ],
  authors: [
    { name: "Michael Perry Tettey", url: "https://tiktok.com/@okponglo_zuck" },
  ],
  creator: "Michael Perry Tettey",
  publisher: "Zuckies",
  metadataBase: new URL("https://zuckies.bflabs.tech"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://zuckies.bflabs.tech",
    siteName: "Zuckies Mentorship",
    title: "Zuckies | Free Software Engineering Mentorship",
    description:
      "Level up your engineering. One conversation at a time. Free mentorship with real structure - no hand-holding.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zuckies - Free Software Engineering Mentorship",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zuckies | Free Software Engineering Mentorship",
    description:
      "Level up your engineering. One conversation at a time. Free mentorship with real structure.",
    images: ["/og-image.png"],
    creator: "@okponglo_zuck",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-touch-icon.svg",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
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
        className={`${geistSans.variable} ${geistMono.variable} ${architectsDaughter.variable} font-hand antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
