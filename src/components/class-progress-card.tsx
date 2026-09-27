"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClassProgress, LessonAccess } from "@/lib/types";
import { LIFETIME_CLASS_SETS } from "@/lib/types";
import { useT } from "@/i18n/client";

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
  const t = useT();
  if (lessonAccess === "lifetime") {
    return (
      <Card className="border-brand-accent/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("Lifetime lesson access")}
          </CardTitle>
          <CardDescription>
            {t(
              "Every lesson on the lessons site is yours for good. Obrigado for learning with Trevor!",
            )}
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
            {t("You qualify for lifetime lesson access!")}
          </CardTitle>
          <CardDescription>
            {t(
              "You've finished {sets} sets of {size} classes. Trevor will set up lifetime access to every lesson for you.",
              { sets: LIFETIME_CLASS_SETS, size: progress.class_package },
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t("Toward lifetime lesson access")}
        </CardTitle>
        <CardDescription>
          {t(
            "Finish {sets} sets of {size} classes to qualify for lifetime access to every lesson.",
            { sets: LIFETIME_CLASS_SETS, size: progress.class_package },
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="progressbar"
          aria-label={t("Classes toward lifetime lesson access")}
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
          {t("{done} of {needed} classes · {setsDone} of {sets} sets", {
            done,
            needed: progress.needed,
            setsDone,
            sets: LIFETIME_CLASS_SETS,
          })}
        </p>
      </CardContent>
    </Card>
  );
}
