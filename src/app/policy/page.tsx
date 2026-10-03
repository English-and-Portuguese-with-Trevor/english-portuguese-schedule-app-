import type { Metadata } from "next";

import { LOCALES } from "@/i18n/format";
import { getSiteLanguage } from "@/i18n/server";
import { translator } from "@/i18n/translate";

export const metadata: Metadata = {
  title: "Class policy — English & Portuguese with Trevor",
};

const CONTACT_EMAIL = "englishportuguesewithtrevor@gmail.com";
const UPDATED = "2026-10-03";

/**
 * The rules for private classes (Trevor, 2026-10-03): booking a class means
 * agreeing to them, and the booking dialog says so with a link here. Written
 * in the site language, unlike the privacy page.
 */
export default async function PolicyPage() {
  const lang = await getSiteLanguage();
  const t = translator(lang);
  const updated = new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${UPDATED}T12:00:00Z`),
  );
  const sections: { title: string; lines: string[] }[] = [
    {
      title: t("Classes"),
      lines: [
        t(
          "Classes are one hour on Google Meet, at the time you book on the schedule app. New students book 30-minute classes until Trevor adds them as his student.",
        ),
        t("Times are shown in your own time zone. Trevor teaches from Denver (Mountain Time)."),
      ],
    },
    {
      title: t("Packages"),
      lines: [t("Classes come in packages of 4 or 8, paid before the package starts. A class counts as used when it takes place.")],
    },
    {
      title: t("Cancellations and changes"),
      lines: [
        t("You can cancel or move a class in the app up to 24 hours before it starts, at no cost."),
        t("A class canceled less than 24 hours before, or missed, counts as used."),
        t("If Trevor cancels a class, it doesn't count and you book another time."),
        t("A class requested less than 72 hours ahead stays pending until Trevor approves it."),
      ],
    },
    {
      title: t("Refunds for private classes"),
      lines: [t("Private class packages aren't refunded. You use up a package by taking the classes you paid for.")],
    },
    {
      title: t("Lesson subscriptions"),
      lines: [
        t(
          "You can cancel a lesson subscription anytime in Settings. It stays active until the end of the period you paid for, and that period isn't refunded.",
        ),
        t("Within 14 days of your first payment, email {email} for a full refund.", { email: CONTACT_EMAIL }),
      ],
    },
    {
      title: t("Students under 18"),
      lines: [
        t(
          "The sites and classes are for adults. For a student under 18, a parent or guardian creates the account, books the classes and is the contact for them.",
        ),
      ],
    },
    {
      title: t("Changes to this policy"),
      lines: [t("Trevor may update these rules; the date at the top shows the latest version. Questions? Email {email}.", { email: CONTACT_EMAIL })],
    },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <a href="https://englishandportuguesewithtrevor.com" className="font-display text-xl text-brand">
        English <em className="text-brand-accent">&amp;</em> Portuguese with Trevor
      </a>
      <h1 className="mt-8 text-2xl font-semibold">{t("Class policy")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("Last updated {date}", { date: updated })}</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed">
        <p>{t("These are the rules for private classes with Trevor. Booking a class means you agree to them.")}</p>
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">{section.title}</h2>
            {section.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ))}
        <p>
          <a href="/privacy" className="underline">
            {t("Privacy Policy")}
          </a>
        </p>
      </div>
    </main>
  );
}
