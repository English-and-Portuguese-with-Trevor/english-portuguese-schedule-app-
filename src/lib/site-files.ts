import { createServerJobClient } from "@/lib/integration-status";

/**
 * The lessons site's lessons.json or free-lessons.json, from the database's
 * copy (site_files, refreshed every 15 minutes by pg_cron;
 * 20261029130000_site_files.sql): the server's own fetches of
 * englishandportuguesewithtrevor.com don't get through from Vercel.
 * Null when there's no copy yet.
 */
export async function siteFile<T>(name: "lessons" | "free-lessons"): Promise<T | null> {
  const { data } = await createServerJobClient().from("site_files").select("body").eq("name", name).maybeSingle();
  return (data?.body as T | undefined) ?? null;
}
