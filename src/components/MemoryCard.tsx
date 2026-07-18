"use client";

import { CalendarDays, LinkIcon, Network } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/cn";
import type { KnowledgeNode, SearchHit } from "@/lib/types";

const TYPE_DOT: Record<string, string> = {
  memory: "bg-synapse",
  person: "bg-coral",
  project: "bg-blueprint",
  topic: "bg-signal",
  source: "bg-ink-400",
  claim: "bg-violet",
  question: "bg-blueprint"
};

export function MemoryCard({
  node,
  compact = false,
  onFocus
}: {
  node: KnowledgeNode | SearchHit;
  compact?: boolean;
  onFocus?: (id: string) => void;
}) {
  const hit = "score" in node ? node : null;

  return (
    <article className="group border border-hairline bg-surface p-3 transition-colors hover:border-synapse/40 hover:bg-surface-raised lg:h-[320px] xl:h-[300px] h-[249px]">
      <div className="flex flex-col justify-between h-full">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-400">
                <span className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[node.nodeType] ?? "bg-ink-400")} />
                {node.nodeType}
              </p>
              <h3 className={cn("mt-1.5 font-semibold leading-tight text-ink-50", compact ? "text-sm" : "text-base")}>
                {node.title}
              </h3>
            </div>
            {hit ? (
              <div className="shrink-0 border border-synapse/30 bg-synapse-soft px-2 py-1 font-mono text-xs font-bold text-synapse">
                {hit.score.toFixed(2)}
              </div>
            ) : null}
          </div>
          <p className={cn("mt-2 text-sm leading-6 text-ink-400", compact ? "line-clamp-2" : "line-clamp-3")}>
            {node.summary || node.content}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {node.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="border border-hairline bg-surface-inset px-2 py-1 font-mono text-[11px] text-ink-400">
                #{tag}
              </span>
            ))}
            {hit?.matchedVia.slice(0, 2).map((item) => (
              <span key={item} className="border border-blueprint/30 bg-blueprint-soft px-2 py-1 font-mono text-[11px] text-blueprint">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5 text-xs text-ink-600">
          <span className="inline-flex items-center gap-1.5 font-mono">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDistanceToNowStrict(new Date(node.createdAt), { addSuffix: true })}
          </span>
          <div className="flex items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
            {node.sourceUrl ? (
              <a
                href={node.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 w-7 items-center justify-center border border-hairline bg-surface-inset text-ink-400 hover:border-synapse/40 hover:text-synapse"
                title="Open source"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {onFocus ? (
              <button
                type="button"
                onClick={() => onFocus(node.id)}
                className="inline-flex h-7 w-7 items-center justify-center border border-hairline bg-surface-inset text-ink-400 hover:border-synapse/40 hover:text-synapse"
                title="Focus graph"
              >
                <Network className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

      </div>
    </article>
  );
}