import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ibmPlexSansArabic, sacramento, sora } from "./fonts";
import { dirForLocale } from "@/i18n/config";
import { isPseudoRtlEnabled, PSEUDO_RTL_COOKIE } from "@/i18n/pseudo-rtl";
import { PseudoRtlSync } from "@/components/app-shell/PseudoRtlSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alsama Lesson Planner",
  description: "Plan and submit Alsama-format lessons.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  // Dev-only pseudo-RTL: force dir="rtl" while staying in English to mirror-test
  // the UI before Arabic exists. Gated on ENABLE_PSEUDO_RTL (not NODE_ENV).
  const pseudoRtlEnabled = isPseudoRtlEnabled();
  const pseudoRtlActive =
    pseudoRtlEnabled &&
    (await cookies()).get(PSEUDO_RTL_COOKIE)?.value === "1";

  const lang = pseudoRtlActive ? "en" : locale;
  const dir = pseudoRtlActive ? "rtl" : dirForLocale(locale);

  return (
    <html
      lang={lang}
      dir={dir}
      className={`${sora.variable} ${ibmPlexSansArabic.variable} ${sacramento.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider messages={messages}>
          {pseudoRtlEnabled ? <PseudoRtlSync active={pseudoRtlActive} /> : null}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
