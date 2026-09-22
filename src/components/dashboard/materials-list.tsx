import { FileText, Link2, Image, File, ExternalLink } from "lucide-react";
import type { Material } from "@/db/schema";

const icons = { PDF: FileText, LINK: Link2, IMAGE: Image, DOCUMENT: File } as const;

export function MaterialsList({ materials }: { materials: Material[] }) {
  if (!materials.length)
    return <p className="text-sm text-zinc-500">Sem materiais no momento.</p>;
  return (
    <ul className="space-y-2">
      {materials.map((m) => {
        const Icon = icons[m.type] ?? Link2;
        return (
          <li key={m.id}>
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-emerald-700 transition"
            >
              <Icon className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-sm text-zinc-100 flex-1 truncate">
                {m.title}
              </span>
              <span className="text-[10px] uppercase text-zinc-500">
                {m.type}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-600" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
