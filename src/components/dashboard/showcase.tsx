"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LessonCard } from "./lesson-card";
import { formatDate } from "@/lib/utils/format";
import type { ShowcaseLesson } from "@/lib/queries/showcase";

export function Showcase({ lessons }: { lessons: ShowcaseLesson[] }) {
  const [query, setQuery] = useState("");
  const rowRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter(
      (l) =>
        l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
    );
  }, [query, lessons]);

  const searching = query.trim().length > 0;
  const hero = !searching ? lessons[0] : undefined;
  const rowLessons = !searching ? lessons : filtered;

  if (!lessons.length) {
    return (
      <div className="py-24 text-center text-zinc-500">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-zinc-900 grid place-items-center">
          📖
        </div>
        <p>Nenhum estudo publicado ainda. Volte na terça!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-4">
      {hero && (
        <section className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-950 min-h-[280px]">
          {hero.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/70 to-transparent" />
          <div className="relative p-6 sm:p-10 max-w-xl space-y-3">
            <p className="text-[11px] tracking-widest text-emerald-400">
              AULA MAIS RECENTE · {formatDate(hero.date)}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{hero.title}</h2>
            <p className="text-sm text-zinc-300 line-clamp-2">{hero.description}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild className="bg-emerald-700 hover:bg-emerald-800 text-white">
                <Link href={`/dashboard/lessons/${hero.id}`}>
                  <Play className="mr-2 h-4 w-4" /> Estudar
                </Link>
              </Button>
              {hero.videoUrl && (
                <Button
                  asChild
                  variant="secondary"
                  className="bg-white/15 text-white hover:bg-white/25 backdrop-blur"
                >
                  <Link href={`/dashboard/lessons/${hero.id}#video`}>
                    Vídeo complementar
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar estudo…"
            className="max-w-sm bg-zinc-900 border-zinc-800 text-zinc-100"
            aria-label="Buscar estudo"
          />
        </div>

        {searching ? (
          filtered.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((l) => (
                <WideCard key={l.id} lesson={l} />
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm py-8">Nenhum estudo encontrado.</p>
          )
        ) : (
          <div className="relative group/row">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Todos os estudos</h3>
            <button
              aria-label="Anterior"
              onClick={() => rowRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
              className="hidden md:grid absolute left-0 top-1/2 z-10 w-9 h-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover/row:opacity-100 transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div ref={rowRef} className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth">
              {rowLessons.map((l) => (
                <LessonCard key={l.id} lesson={l} />
              ))}
            </div>
            <button
              aria-label="Próximo"
              onClick={() => rowRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
              className="hidden md:grid absolute right-0 top-1/2 z-10 w-9 h-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover/row:opacity-100 transition"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WideCard({ lesson }: { lesson: ShowcaseLesson }) {
  return (
    <Link
      href={`/dashboard/lessons/${lesson.id}`}
      className="block rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-emerald-700 transition"
    >
      <div className="aspect-video bg-gradient-to-br from-zinc-700 to-zinc-900 relative">
        {lesson.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-zinc-100 line-clamp-1">{lesson.title}</p>
        <p className="text-xs text-zinc-500 mt-1">{formatDate(lesson.date)}</p>
      </div>
    </Link>
  );
}
