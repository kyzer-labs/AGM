import type { Metadata } from "next";
import { Unbounded, Azeret_Mono } from "next/font/google";
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
        className={`${fontDisplay.variable} ${fontMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
