import { isGoogleConfigured } from "@/lib/google";
import { createServerJobClient } from "@/lib/integration-status";
import { emails, sendNotification, type ArticleReader, type LessonCatalog } from "@/lib/notifications";

const LESSONS_URL = "https://englishandportuguesewithtrevor.com/lessons/lessons.json";

/** The articles lessons.json says came out on `day` (Denver); none if it can't be read. */
export async function articlesReleasedOn(day: string): Promise<LessonCatalog> {
  const catalog: LessonCatalog = await fetch(LESSONS_URL)
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  return catalog.filter((l) => l.article && l.releaseOn === day);
}

/**
 * On Mondays (the daily job), for the articles released today (`released`,
 * from articlesReleasedOn), emails each student who chose article emails the ones in
 * the language they're learning. claim_article_emails marks them first, so a
 * second run never sends twice; anyone with no article in their language
 * today, or whose email failed, is handed back. While Gmail isn't set up
 * nothing is claimed.
 */
export async function sendArticleEmails(secret: string, day: string, released: LessonCatalog) {
  if (!isGoogleConfigured() || !released.length) return 0;

  const supabase = createServerJobClient();
  const { data, error } = await supabase.rpc("claim_article_emails", { p_secret: secret, p_day: day });
  if (error) throw new Error(`claim_article_emails: ${error.message}`);
  const people = (data ?? []) as unknown as ArticleReader[];

  const unsent: string[] = [];
  for (const person of people) {
    const articles = released.filter((l) => (person.learning === "English" ? l.learning === "English" : !l.learning));
    const email = emails.newArticles(person, articles);
    if (!email || !(await sendNotification(email))) unsent.push(person.id);
  }
  if (unsent.length) {
    const { error: unclaimError } = await supabase.rpc("unclaim_article_emails", { p_secret: secret, p_ids: unsent });
    if (unclaimError) console.error("[articles] unclaim_article_emails failed; not sent:", unsent, unclaimError.message);
  }
  return people.length - unsent.length;
}
