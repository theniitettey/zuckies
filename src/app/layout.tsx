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
  title: "Mentorship Onboarding | Michael Perry Tettey",
  description:
    "Free software engineering mentorship by Michael Perry Tettey (Sidequest CEO). Real structure. No hand-holding. Effort is the price of entry.",
  keywords: [
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
  publisher: "Sidequest",
  metadataBase: new URL("https://mentorship.sidequest.dev"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://mentorship.sidequest.dev",
    siteName: "Sidequest Mentorship",
    title: "Free Software Engineering Mentorship | Sidequest CEO",
    description:
      "Level up your engineering. One conversation at a time. Free mentorship with real structure - no hand-holding.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sidequest Mentorship - Free Software Engineering Mentorship",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Software Engineering Mentorship | Sidequest CEO",
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
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
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
