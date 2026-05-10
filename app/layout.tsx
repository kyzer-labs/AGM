import type { Metadata } from "next";
import { Unbounded, Azeret_Mono, Spectral } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const fontDisplay = Unbounded({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-unbounded",
  display: "swap",
});

const fontMono = Azeret_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-azeret-mono",
  display: "swap",
});

// Spectral (Production Type for Google) carries the editorial-technical
// serif role for ceremonial moments: landing headline, results-page
// pull-quotes, candidate biographies. Picked over Playfair Display
// because Playfair is on the brand register's reflex-reject list and
// Spectral was commissioned for institutional long-form reading, which
// matches the AGM portal's emotional outcome (ceremonial civic gravity).
const fontSerif = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "USM CSS AGM Election",
  description:
    "Official AGM election portal for the USM Computer Science Society. Internal evaluation, live AGM voting, and final results.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontDisplay.variable} ${fontMono.variable} ${fontSerif.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
