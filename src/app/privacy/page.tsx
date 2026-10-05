import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — English & Portuguese With Trevor",
};

const CONTACT_EMAIL = "englishportuguesewithtrevor@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <a href="https://englishandportuguesewithtrevor.com" className="title text-xl">
        English <em className="text-brand-accent">&amp;</em> Portuguese With Trevor
      </a>
      <h1 className="title mt-8 text-3xl">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated October 3, 2026</p>

      <div className="mt-8 flex flex-col gap-6 leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-brand [&_ul]:list-disc [&_ul]:pl-5">
        <p>
          This policy explains what information the English &amp; Portuguese With Trevor sites collect, what
          it&apos;s used for, and how to delete it. If anything here is unclear, just email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <section className="flex flex-col gap-2">
          <h2>Which sites this covers</h2>
          <ul>
            <li>
              englishandportuguesewithtrevor.com: the home page, the login page (/login), lessons (/lessons/),
              flashcards (/flashcards/), activities (/activities/), daily puzzles (/dailies/) and conversations
              (/conversations/)
            </li>
            <li>schedule.englishandportuguesewithtrevor.com, for booking classes</li>
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
              your settings (dark mode, the language you&apos;re learning, the site language, the
              translation language and the section the app opens on).
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
              Meet link and calendar event for each class. If you flag a past class to tell Trevor about a
              problem, the flag and the reason you picked are kept too.
            </li>
            <li>
              <strong>Flashcards:</strong> the decks, folders and cards you make, your favorite decks, which
              cards you&apos;ve marked &quot;Got it&quot; or &quot;Still learning&quot; and when each is due for
              review again, and a dated log of those taps.
            </li>
            <li>
              <strong>Lessons:</strong> the lessons you mark as finished, and the knowledge-check questions you
              missed on the first try (the question and how many tries it took).
            </li>
            <li>
              <strong>Activities:</strong> the activities you finish and your scores, and the questions you
              missed, with the date each one comes back for review.
            </li>
            <li>
              <strong>Daily puzzles:</strong> when you&apos;re logged in, which puzzles you finished each day, whether you solved them, and
              your Word of the day guesses, for your stats and streaks.
            </li>
            <li>
              <strong>From Trevor:</strong> the lessons and activities he assigns you.
            </li>
            <li>
              <strong>Reported issues:</strong> if you report a problem in a lesson or activity, which one and
              the reason you picked.
            </li>
          </ul>
          <p>Trevor can see your progress and practice results so he can help you.</p>
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
              creates an account or starts a subscription, a phone notification and a morning email when
              someone flags a class or reports a problem, and an email whenever a class is booked, moved or
              canceled. Only Trevor&apos;s own devices are signed up for these notifications.
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
          <h2>Speaking and listening</h2>
          <p>
            The Activities site and some lessons read sentences aloud, and the Activities speaking drills
            listen to you, using your browser&apos;s built-in speech features. In some browsers (Chrome, for
            example), your voice is sent to the browser&apos;s maker to turn it into text. The sites
            themselves never record, receive or store your voice, and no outside AI voice service is used.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Lesson translations</h2>
          <p>
            Trevor&apos;s lesson explanations can be shown in your site language. Earlier translations were
            made with DeepL and checked with Anthropic&apos;s Claude, and those saved translations are still
            used. For now, new translations are added by hand instead. Only lesson text has ever been sent
            for translation, never anything about you.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Hosting</h2>
          <p>
            The scheduling site is hosted on Vercel; the other sites are hosted on GitHub Pages. Your
            account and data are stored with Supabase. Class events and emails go through Google. Every
            site except the scheduling site loads its fonts from Google Fonts, so Google sees your IP address
            when they load.
          </p>
          <p>
            Everything is stored in the United States (Supabase&apos;s servers in Ohio), and it&apos;s used only
            to run your account, your classes and lessons, and the emails described above. If you&apos;re in
            Brazil, that means your personal data is transferred to the United States, and you keep the
            rights the LGPD gives you: to see, correct or delete it, in Settings or by email.
          </p>
          <p>
            The sites and classes are for adults. For a student under 18, a parent or guardian creates and
            manages the account. The rules for classes themselves are in the{" "}
            <a href="/policy" className="underline">
              class policy
            </a>
            .
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
              language, the translation language and the section the app opens on, so every site looks the
              same. It lasts up to a year and
              stays after you log out.
            </li>
            <li>
              Your browser&apos;s own storage keeps a few things on your device: your theme, the Activities
              sound settings, today&apos;s daily puzzles and your puzzle stats, which of Trevor&apos;s notices
              you&apos;ve closed, and, while you&apos;re logged in, offline copies of your lessons and
              flashcards so you can keep studying if the connection drops. Logging out clears the offline
              copies.
            </li>
          </ul>
          <p>There are no analytics, advertising or tracking cookies.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2>Deleting your account</h2>
          <p>
            Open Settings from the account menu and choose Delete account. If you have a class coming up,
            cancel it first. Deleting cancels any subscription and removes your account, profile, bookings,
            flashcards, progress and results from every site. Otherwise, your information is kept for as long as your
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
