import { ClassNotesWriter } from "@/components/admin/class-notes-writer";
import { getDisplayNames } from "@/lib/display-names";
import { createClient } from "@/lib/supabase/server";

// The class notes writer: private students (a class package) only, as the lessons site's Notes panel.
export default async function AdminNotesPage() {
  const supabase = await createClient();
  const [{ data: students }, displayNames] = await Promise.all([
    supabase.from("profiles").select("id").not("class_package", "is", null),
    getDisplayNames(supabase),
  ]);
  const options = (students ?? [])
    .map((s) => ({ id: s.id, name: displayNames[s.id] ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Class notes</h1>
        <p className="text-sm text-muted-foreground">
          Pick a class, type your notes, and the AI tidies them and suggests lessons for anything the student found hard.
        </p>
      </div>
      <ClassNotesWriter students={options} />
    </div>
  );
}
