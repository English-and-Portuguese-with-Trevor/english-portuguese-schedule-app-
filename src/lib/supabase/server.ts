import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { authCookieOptions } from "@/lib/supabase/cookie-options";
import type { Database } from "@/lib/supabase/database.types";

export async function createClient() {
  const cookieStore = await cookies();
  const headerList = await headers();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(
        headerList.get("host") ?? "",
        headerList.get("x-forwarded-proto") === "https",
      ),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component; ignored because proxy
            // refreshes the session on every request.
          }
        },
      },
    },
  );
}
