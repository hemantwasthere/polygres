"use client";

import { Activity, Database, GitBranch, Radar } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CapabilityStatus, ProductMetrics } from "@/lib/types";

function Pill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide",
        active ? "border-synapse/30 bg-synapse-soft text-synapse" : "border-signal/30 bg-signal-soft text-signal"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-synapse" : "bg-signal")} />
      {children}
    </span>
  );
}

export function StatusPanel({ status, metrics }: { status: CapabilityStatus; metrics: ProductMetrics }) {
  const stats = [
    { label: "Memories", value: metrics.memoryCount },
    { label: "Entities", value: metrics.entityCount },
    { label: "Edges", value: metrics.relationshipCount },
    { label: "Types", value: metrics.relationshipTypes }
  ];

  return (
    <aside className="space-y-3">
      <section className="border border-hairline bg-surface p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-200">Runtime</h2>
          <Activity className="h-4 w-4 text-synapse" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill active={status.pgGraph.available}>{status.pgGraph.available ? "pgGraph native" : "SQL graph"}</Pill>
          <Pill active={status.vector.available}>{status.vector.available ? "HNSW vector" : "Local cosine"}</Pill>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="border border-hairline bg-surface-inset p-3">
              <dt className="font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-600">{stat.label}</dt>
              <dd className="mt-1 font-display text-xl font-bold text-ink-50">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="border border-hairline bg-surface p-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-200">Signals</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3 border border-hairline bg-surface-inset p-2.5">
            <span className="inline-flex items-center gap-2 font-medium text-ink-200">
              <GitBranch className="h-4 w-4 text-blueprint" />
              Graph projection
            </span>
            <span className="font-mono font-bold text-ink-50">
              {status.pgGraph.nodeCount ?? metrics.entityCount + metrics.memoryCount}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border border-hairline bg-surface-inset p-2.5">
            <span className="inline-flex items-center gap-2 font-medium text-ink-200">
              <Radar className="h-4 w-4 text-coral" />
              Vector index
            </span>
            <span className="font-mono font-bold text-ink-50">{status.vector.indexed ? "on" : "fallback"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border border-hairline bg-surface-inset p-2.5">
            <span className="inline-flex items-center gap-2 font-medium text-ink-200">
              <Database className="h-4 w-4 text-synapse" />
              Captures
            </span>
            <span className="font-mono font-bold text-ink-50">{metrics.capturesThisWeek}/7d</span>
          </div>
        </div>
      </section>
    </aside>
  );
}