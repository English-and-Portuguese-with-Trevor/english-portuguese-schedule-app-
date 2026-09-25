import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — English & Portuguese with Trevor",
};

const CONTACT_EMAIL = "englishportuguesewithtrevor@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <a href="https://englishandportuguesewithtrevor.com" className="font-display text-xl text-brand">
        English <em className="text-brand-accent">&amp;</em> Portuguese with Trevor
      </a>
      <h1 className="mt-8 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated September 25, 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        <p>
          This policy covers the lesson scheduling site at schedule.englishandportuguesewithtrevor.com. It
          explains what information is collected when you use it and what it&apos;s used for.
        </p>

        <section className="flex flex-col gap-2">
          <h2>What we collect</h2>
          <ul>
            <li>
              Your name, email address, and profile picture from Google when you sign in with your Google
              account.
            </li>
            <li>The lessons you book, request, or cancel, and when.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2>How it&apos;s used</h2>
          <ul>
            <li>To let you book and manage your lessons.</li>
            <li>
              To send you emails and Google Calendar invitations about your lessons, including the Google
              Meet link for each lesson. These come from {CONTACT_EMAIL}.
            </li>
            <li>To let your teacher see and manage the schedule.</li>
          </ul>
          <p>
            Your information is never sold, shared for advertising, or used for anything other than your
            lessons.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Google account access</h2>
          <p>
            Signing in only gives this site your basic Google profile (name, email, and picture). It never
            gets access to your Gmail, Calendar, or files. The site uses the teacher&apos;s own Google
            account, not yours, to create lesson events and send emails.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Where it&apos;s stored</h2>
          <p>
            Account and booking information is stored with Supabase, and the site is hosted on Vercel.
            Lesson events and emails are handled by Google.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Your choices</h2>
          <p>
            You can ask for your account and booking history to be deleted at any time by emailing{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Contact</h2>
          <p>
            Questions about this policy:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
