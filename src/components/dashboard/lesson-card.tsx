import Link from "next/link";
import { formatDate } from "@/lib/utils/format";
import type { ShowcaseLesson } from "@/lib/queries/showcase";
import { Badge } from "@/components/ui/badge";

const badgeMap = {
  ANSWERED: { label: "✓ Respondida", className: "bg-emerald-700 text-white" },
  PENDING: { label: "Pendente", className: "bg-amber-600 text-white" },
  NONE: { label: "Sem questionário", className: "bg-zinc-700 text-zinc-200" },
} as const;

export function LessonCard({ lesson }: { lesson: ShowcaseLesson }) {
  const b = badgeMap[lesson.badge];
  return (
    <Link
      href={`/dashboard/lessons/${lesson.id}`}
      className="group block w-44 sm:w-52 shrink-0 snap-start rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-zinc-700 to-zinc-900 transition group-hover:scale-[1.03] group-hover:ring-2 group-hover:ring-emerald-600">
        {lesson.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute top-2 right-2">
          <Badge className={b.className + " text-[10px]"}>{b.label}</Badge>
        </span>
        <div className="absolute bottom-2 left-2 right-2 text-xs text-zinc-200 line-clamp-2 font-medium">
          {lesson.title}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">{formatDate(lesson.date)}</p>
    </Link>
  );
}
