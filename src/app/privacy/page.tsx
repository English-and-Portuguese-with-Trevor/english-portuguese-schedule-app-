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
      <p className="mt-1 text-sm text-muted-foreground">Last updated September 29, 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        <p>
          This policy explains what information the English &amp; Portuguese with Trevor sites collect, what
          it&apos;s used for, and how to delete it. If anything here is unclear, just email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <section className="flex flex-col gap-2">
          <h2>Which sites this covers</h2>
          <ul>
            <li>englishandportuguesewithtrevor.com, including the login page (/login)</li>
            <li>lessons.englishandportuguesewithtrevor.com</li>
            <li>flashcards.englishandportuguesewithtrevor.com</li>
            <li>activities.englishandportuguesewithtrevor.com</li>
            <li>schedule.englishandportuguesewithtrevor.com</li>
          </ul>
          <p>
            You have one account for all of them, and everything is kept in one database, hosted by Supabase.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Signing in</h2>
          <ul>
            <li>
              <strong>With Google:</strong> Google shares your name, email address and profile picture. The
              sites use your name and email; the picture isn&apos;t used or shown. Signing in only asks for
              your basic Google profile. It never gives access to your Gmail, Calendar or files.
            </li>
            <li>
              <strong>With email and password:</strong> your password is stored only in scrambled (hashed)
              form by Supabase, so nobody can read it, including Trevor. Account emails, like confirming your
              address or resetting your password, are sent by Resend from
              no-reply@englishandportuguesewithtrevor.com.
            </li>
            <li>
              The email forms use Cloudflare Turnstile, a quick check that you&apos;re a person and not a bot.
            </li>
            <li>
              When you choose a new password, it&apos;s checked against passwords known from data leaks (Have
              I Been Pwned). Only the first 5 characters of a scrambled (SHA-1) version of it leave your
              browser, so the service never learns your password.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2>What we keep</h2>
          <ul>
            <li>
              <strong>Your account:</strong> your name and email, when you signed up and last signed in, and
              your settings (dark mode, the language you&apos;re learning, the site language and the
              translation language).
            </li>
            <li>
              <strong>Lesson access:</strong> whether you have access to the paid lessons (none, given by
              Trevor, subscriber, or lifetime), your class package, and how many classes you took before the
              scheduling site existed.
            </li>
            <li>
              <strong>Classes:</strong> the classes you book, request, move or cancel and when, whether a
              cancellation was late, the lesson language you choose, your WhatsApp number if you choose to give
              it, your time zone (from your browser, so times are shown in your local time), and the Google
              Meet link and calendar event for each class.
            </li>
            <li>
              <strong>Flashcards:</strong> the decks, folders and cards you make, your favorite decks, which
              cards you&apos;ve marked &quot;Got it&quot; or &quot;Still learning&quot;, and a dated log of
              those taps. Trevor can see your study progress so he can help you.
            </li>
            <li>
              <strong>Activities:</strong> nothing. Your drill answers and scores aren&apos;t saved.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2>How it&apos;s used</h2>
          <ul>
            <li>To let you book and manage your classes, and to send you a reminder email before each class.</li>
            <li>
              To send you Google Calendar invitations (with the Google Meet link) and emails about your
              classes. These come from Trevor&apos;s own Google account, {CONTACT_EMAIL}, not yours.
            </li>
            <li>
              To let Trevor know what&apos;s happening: he gets an email and a phone notification when someone
              creates an account or starts a subscription, and an email whenever a class is booked, moved or
              canceled.
            </li>
            <li>If you give your WhatsApp number, so Trevor can contact you about your classes.</li>
          </ul>
          <p>
            Your information is used only to run the sites, your lessons and your subscription. It&apos;s
            never sold, and never used for advertising.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Payments</h2>
          <p>
            Subscriptions are handled by Stripe. When you subscribe, your name, email and account ID are sent
            to Stripe. Your card details go straight to Stripe and never reach these sites. We keep your
            Stripe customer ID, your subscription status, your plan and its renewal date.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Speaking and listening drills</h2>
          <p>
            The Activities site reads sentences aloud and listens to you speak using your browser&apos;s
            built-in speech features. In some browsers (Chrome, for example), your voice is sent to the
            browser&apos;s maker to turn it into text. The sites themselves never record, receive or store
            your voice.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Lesson translations</h2>
          <p>
            Trevor&apos;s lesson explanations are translated by DeepL and checked by Anthropic&apos;s Claude.
            Only the lesson text is sent, never anything about you.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Hosting</h2>
          <p>
            The scheduling site is hosted on Vercel; the other sites are hosted on GitHub Pages. Your
            account and data are stored with Supabase. Class events and emails go through Google. The
            main site, lessons, flashcards and activities load their fonts from Google Fonts, so Google sees
            your IP address when they load.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Cookies and browser storage</h2>
          <ul>
            <li>
              <strong>ept-auth</strong> keeps you logged in across all the sites.
            </li>
            <li>
              <strong>ept-prefs</strong> remembers dark mode, the language you&apos;re learning, the site
              language and the translation language, so every site looks the same. It lasts up to a year and
              stays after you log out.
            </li>
            <li>
              Your browser&apos;s own storage keeps a few things on your device: your theme, the Activities
              sound settings, and, while you&apos;re logged in, offline copies of your lessons and flashcards
              so you can keep studying if the connection drops. Logging out clears the offline copies.
            </li>
          </ul>
          <p>There are no analytics, advertising or tracking cookies.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Deleting your account</h2>
          <p>
            Open Settings from the account menu and choose Delete account. If you have a class coming up,
            cancel it first. Deleting cancels any subscription and removes your account, profile, bookings,
            flashcards and progress from every site. Otherwise, your information is kept for as long as your
            account exists.
          </p>
          <p>A few things stay for a while or are out of our hands:</p>
          <ul>
            <li>Nightly database backups, which are kept for up to 90 days.</li>
            <li>Emails and calendar invitations that were already sent.</li>
            <li>Stripe&apos;s own records of your payments.</li>
          </ul>
          <p>
            If you have trouble deleting your account, email{" "}
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
