import type { createClient } from "@/lib/supabase/server";

interface NameSource {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

function baseName(p: NameSource): string {
  const parts = (p.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
  if (parts.length === 1) return parts[0];
  if (p.email) return p.email.split("@")[0];
  return "Unknown";
}

/**
 * "First L." for every profile. When several people collapse to the same
 * short name, each gets a number in signup order ("Trevor L. 1", "Trevor L.
 * 2"). Must be computed over the whole profile list, not a page of it, so a
 * given person keeps the same number everywhere.
 */
export function buildDisplayNames(profiles: NameSource[]): Record<string, string> {
  const groups = new Map<string, NameSource[]>();
  for (const p of [...profiles].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const key = baseName(p).toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }

  const names: Record<string, string> = {};
  for (const group of groups.values()) {
    group.forEach((p, i) => {
      names[p.id] = group.length > 1 ? `${baseName(p)} ${i + 1}` : baseName(p);
    });
  }
  return names;
}

export async function getDisplayNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Record<string, string>> {
  const { data } = await supabase.from("profiles").select("id, full_name, email, created_at");
  return buildDisplayNames(data ?? []);
}
