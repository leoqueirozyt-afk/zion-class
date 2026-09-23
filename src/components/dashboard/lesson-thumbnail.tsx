"use client";

export function LessonThumbnail({ src }: { src: string }) {
  return (
    <div className="rounded-2xl overflow-hidden aspect-[3/1] bg-zinc-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}
