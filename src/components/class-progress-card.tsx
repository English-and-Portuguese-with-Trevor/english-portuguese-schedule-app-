import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClassProgress, LessonAccess } from "@/lib/types";
import { LIFETIME_CLASS_SETS } from "@/lib/types";

/**
 * A student's progress toward lifetime lesson access (three class sets).
 * Shown only once Trevor has set their class package. Trevor gives the access
 * himself, so reaching the goal only says they qualify.
 */
export function ClassProgressCard({
  progress,
  lessonAccess,
}: {
  progress: ClassProgress | null;
  lessonAccess: LessonAccess;
}) {
  if (lessonAccess === "lifetime") {
    return (
      <Card className="border-brand-accent/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lifetime lesson access</CardTitle>
          <CardDescription>
            Every lesson on the lessons site is yours for good. Obrigado for
            learning with Trevor!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!progress?.class_package || !progress.needed) return null;

  const done = Math.min(progress.completed, progress.needed);
  const setsDone = Math.floor(done / progress.class_package);

  if (progress.eligible) {
    return (
      <Card className="border-brand-accent/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            You qualify for lifetime lesson access!
          </CardTitle>
          <CardDescription>
            You&apos;ve finished {LIFETIME_CLASS_SETS} sets of{" "}
            {progress.class_package} classes. Trevor will set up lifetime access
            to every lesson for you.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Toward lifetime lesson access
        </CardTitle>
        <CardDescription>
          Finish {LIFETIME_CLASS_SETS} sets of {progress.class_package} classes
          to qualify for lifetime access to every lesson.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="progressbar"
          aria-label="Classes toward lifetime lesson access"
          aria-valuemin={0}
          aria-valuemax={progress.needed}
          aria-valuenow={done}
          className="h-2 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className="h-full bg-brand"
            style={{ width: `${(done / progress.needed) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {done} of {progress.needed} classes · {setsDone} of{" "}
          {LIFETIME_CLASS_SETS} sets
        </p>
      </CardContent>
    </Card>
  );
}
