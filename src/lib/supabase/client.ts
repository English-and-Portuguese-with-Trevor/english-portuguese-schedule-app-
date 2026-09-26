"use client";

import { createBrowserClient } from "@supabase/ssr";

import { authCookieOptions } from "@/lib/supabase/cookie-options";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(
        window.location.host,
        window.location.protocol === "https:",
      ),
    },
  );
}
