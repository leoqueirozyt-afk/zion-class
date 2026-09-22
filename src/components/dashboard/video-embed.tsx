"use client";

import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";

function toEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/shorts/"))
        return `https://www.youtube.com/embed${u.pathname.replace("/shorts/", "/")}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (host === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id)
        ? `https://player.vimeo.com/video/${id}`
        : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function VideoEmbed({ url }: { url: string }) {
  const embed = toEmbed(url);
  if (!embed) {
    return (
      <Button asChild variant="outline">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Video className="mr-2 h-4 w-4" /> Assistir vídeo complementar
        </a>
      </Button>
    );
  }
  return (
    <div className="aspect-video rounded-xl overflow-hidden border border-zinc-800">
      <iframe
        src={embed}
        className="w-full h-full"
        allowFullScreen
        title="Vídeo complementar"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
      />
    </div>
  );
}
