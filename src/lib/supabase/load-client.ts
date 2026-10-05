// supabase-js is about a quarter of a page's JavaScript and no page needs it
// to show, so the browser client loads on first use (client.ts stays the one
// place that makes it).
let client: Promise<typeof import("@/lib/supabase/client")> | null = null;

export function loadClient() {
  client ??= import("@/lib/supabase/client");
  return client.then((m) => m.createClient());
}
