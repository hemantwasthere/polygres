"use client";

import { MousePointer2, Waypoints } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GraphPayload, NodeType } from "@/lib/types";

const NODE_COLORS: Record<NodeType, { fill: string; stroke: string; text: string }> = {
  memory: { fill: "#12302B", stroke: "#57E8C8", text: "#8FF3DE" },
  person: { fill: "#33201A", stroke: "#FF8A65", text: "#FFB49B" },
  project: { fill: "#152539", stroke: "#6FA8FF", text: "#A8C8FF" },
  topic: { fill: "#332711", stroke: "#F2B84D", text: "#F8D48A" },
  source: { fill: "#232833", stroke: "#A9B1C3", text: "#C9CEDA" },
  claim: { fill: "#241C3A", stroke: "#B79DFF", text: "#D3C4FF" },
  question: { fill: "#122A2E", stroke: "#63C7D6", text: "#9FE1EA" }
};

function truncate(value: string, max = 22) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

export function GraphCanvas({
  graph,
  onFocus,
  className
}: {
  graph: GraphPayload;
  onFocus: (id: string) => void;
  className?: string;
}) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  if (!graph.nodes.length) {
    return (
      <div
        className={cn(
          "flex aspect-[1.52] min-h-[360px] flex-col items-center justify-center gap-2 border border-hairline bg-surface-inset text-sm text-ink-600",
          className
        )}
      >
        <Waypoints className="h-5 w-5 text-ink-800" />
        <span className="font-mono text-xs uppercase tracking-wider">No graph nodes loaded</span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden border border-hairline bg-surface-inset", className)}>
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 border border-hairline bg-void/85 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-400 backdrop-blur">
        <MousePointer2 className="h-3.5 w-3.5 text-synapse" />
        {graph.nodes.length} nodes / {graph.edges.length} edges
      </div>
      <svg viewBox="0 0 880 580" className="h-full min-h-[360px] w-full">
        <defs>
          <pattern id="graph-grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#FFFFFF" strokeOpacity="0.05" strokeWidth="1" />
          </pattern>
          <radialGradient id="graph-vignette" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="#161C26" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0A0D12" stopOpacity="0.95" />
          </radialGradient>
          <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="880" height="580" fill="url(#graph-vignette)" />
        <rect width="880" height="580" fill="url(#graph-grid)" />
        {graph.edges.map((edge) => {
          const from = nodeById.get(edge.fromNodeId);
          const to = nodeById.get(edge.toNodeId);
          if (!from || !to) {
            return null;
          }
          const touchesFocus = edge.fromNodeId === graph.focusId || edge.toNodeId === graph.focusId;
          const label = truncate(edge.label.replaceAll("_", " "), 18);
          const midX = ((from.x ?? 0) + (to.x ?? 0)) / 2;
          const midY = ((from.y ?? 0) + (to.y ?? 0)) / 2 - 6;
          return (
            <g key={edge.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={touchesFocus ? "#57E8C8" : "#FFFFFF"}
                strokeOpacity={touchesFocus ? 0.55 : 0.14 + edge.strength * 0.18}
                strokeWidth={1 + edge.strength * 2}
              />
              {touchesFocus ? (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#57E8C8"
                  strokeOpacity={0.9}
                  strokeWidth={1.4}
                  strokeDasharray="3 9"
                  className="motion-safe:animate-signal-flow"
                />
              ) : null}
              <rect
                x={midX - label.length * 3}
                y={midY - 11}
                width={label.length * 6}
                height={14}
                fill="#0A0D12"
                fillOpacity={0.75}
              />
              <text
                x={midX}
                y={midY}
                textAnchor="middle"
                className="node-label select-none text-[9px] font-semibold uppercase tracking-wide"
                fill={touchesFocus ? "#8FF3DE" : "#6B7280"}
              >
                {label}
              </text>
            </g>
          );
        })}
        {graph.nodes.map((node) => {
          const colors = NODE_COLORS[node.nodeType];
          const isFocus = node.id === graph.focusId;
          const radius = isFocus ? 34 : node.nodeType === "memory" ? 28 : 24;
          return (
            <g
              key={node.id}
              tabIndex={0}
              role="button"
              aria-label={`Focus ${node.title}`}
              onClick={() => onFocus(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onFocus(node.id);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <title>{node.title}</title>
              {isFocus ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 10}
                  fill="none"
                  stroke={colors.stroke}
                  strokeOpacity={0.5}
                  strokeWidth="2"
                  className="motion-safe:animate-pulse-ring"
                  style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                />
              ) : null}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isFocus ? 2.5 : 1.5}
                filter={isFocus ? "url(#node-glow)" : undefined}
              />
              <text
                x={node.x}
                y={(node.y ?? 0) + radius + 18}
                textAnchor="middle"
                className="select-none text-[12px] font-semibold"
                fill="#F3F5F8"
                fontFamily="var(--font-sans)"
              >
                {truncate(node.title)}
              </text>
              <text
                x={node.x}
                y={(node.y ?? 0) + 4}
                textAnchor="middle"
                fill={colors.text}
                className="node-label select-none text-[10px] font-bold uppercase tracking-wide"
              >
                {node.nodeType.slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}