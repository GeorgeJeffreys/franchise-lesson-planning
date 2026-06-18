import type { Metadata } from "next";
import { sacramento, sora } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alsama Lesson Planner",
  description: "Plan and submit Alsama-format lessons.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${sacramento.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
