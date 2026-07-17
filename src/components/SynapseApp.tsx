"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  BrainCircuit,
  Check,
  CircleAlert,
  DatabaseZap,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles
} from "lucide-react";
import { GraphCanvas } from "./GraphCanvas";
import { MemoryCard } from "./MemoryCard";
import { StatusPanel } from "./StatusPanel";
import { cn } from "@/lib/cn";
import type {
  AskResponse,
  CapabilityStatus,
  GraphPayload,
  KnowledgeNode,
  ProductMetrics,
  SearchHit
} from "@/lib/types";

type DashboardData = {
  metrics: ProductMetrics;
  status: CapabilityStatus;
  recentMemories: KnowledgeNode[];
  graph: GraphPayload;
  importantNodes: KnowledgeNode[];
  error: string | null;
};

export function SynapseApp({ initialData }: { initialData: DashboardData }) {
  const [metrics, setMetrics] = useState(initialData.metrics);
  const [status, setStatus] = useState(initialData.status);
  const [recentMemories, setRecentMemories] = useState(initialData.recentMemories);
  const [graph, setGraph] = useState(initialData.graph);
  const [importantNodes] = useState(initialData.importantNodes);
  const [captureText, setCaptureText] = useState("");
  const [captureTitle, setCaptureTitle] = useState("");
  const [question, setQuestion] = useState("What should I remember about Polygres and agent memory?");
  const [searchText, setSearchText] = useState("Polygres graph vector memory");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [notice, setNotice] = useState(initialData.error);
  const [isPending, startTransition] = useTransition();

  const topNode = useMemo(() => graph.nodes.find((node) => node.id === graph.focusId) ?? graph.nodes[0], [graph]);
  const noticeIsPositive = notice ? notice.includes("Captured") || notice.includes("refreshed") : false;

  async function focusGraph(id: string) {
    const response = await fetch(`/api/graph?focusId=${encodeURIComponent(id)}&depth=2&limit=34`);
    const payload = await response.json();
    if (payload.error) {
      setNotice(payload.error);
      return;
    }
    setGraph(payload.graph);
  }

  function submitCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const response = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: captureText,
          title: captureTitle || undefined,
          tags: [],
          importance: 4
        })
      });
      const payload = await response.json();
      if (payload.error) {
        setNotice(payload.error);
        return;
      }
      setCaptureText("");
      setCaptureTitle("");
      setGraph(payload.graph);
      setRecentMemories(payload.recentMemories);
      setMetrics(payload.metrics);
      setStatus(payload.status);
      setNotice("Captured and connected.");
    });
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const payload = await response.json();
      if (payload.error) {
        setNotice(payload.error);
        return;
      }
      setAnswer(payload);
      setHits(payload.evidence);
      setGraph(payload.graph);
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchText)}&limit=8`);
      const payload = await response.json();
      if (payload.error) {
        setNotice(payload.error);
        return;
      }
      setHits(payload.hits);
      if (payload.hits?.[0]) {
        await focusGraph(payload.hits[0].id);
      }
    });
  }

  async function refreshStatus() {
    const response = await fetch("/api/status");
    const payload = await response.json();
    if (payload.error) {
      setNotice(payload.error);
      return;
    }
    setStatus(payload.status);
    setMetrics(payload.metrics);
    setNotice("Status refreshed.");
  }

  return (
    <main className="min-h-screen px-3 py-3 text-ink-50 sm:px-4 lg:px-5">
      <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-3 xl:grid-cols-[330px_minmax(0,1fr)_320px]">
        <aside className="space-y-3">
          <section className="relative overflow-hidden border border-hairline bg-surface p-4">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage: "radial-gradient(circle at 85% -10%, rgba(87,232,200,0.16), transparent 55%)"
              }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-synapse">Polygres</p>
                <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-50">Synapse</h1>
              </div>
              <div className="flex h-11 w-11 items-center justify-center border border-synapse/30 bg-synapse-soft text-synapse" title="Knowledge graph">
                <BrainCircuit className="h-6 w-6" />
              </div>
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="border border-hairline bg-surface-inset p-2">
                <p className="font-display text-lg font-bold text-ink-50">{metrics.memoryCount}</p>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-600">Mem</p>
              </div>
              <div className="border border-hairline bg-surface-inset p-2">
                <p className="font-display text-lg font-bold text-ink-50">{metrics.entityCount}</p>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-600">Ent</p>
              </div>
              <div className="border border-hairline bg-surface-inset p-2">
                <p className="font-display text-lg font-bold text-ink-50">{metrics.relationshipCount}</p>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-600">Rel</p>
              </div>
            </div>
          </section>

          <section className="border border-hairline bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-200">Capture</h2>
              <Plus className="h-4 w-4 text-synapse" />
            </div>
            <form onSubmit={submitCapture} className="mt-3 space-y-2">
              <input
                value={captureTitle}
                onChange={(event) => setCaptureTitle(event.target.value)}
                placeholder="Title"
                className="h-10 w-full border border-hairline bg-surface-inset px-3 text-sm font-medium text-ink-50 placeholder:text-ink-600 focus:border-synapse/50"
              />
              <textarea
                value={captureText}
                onChange={(event) => setCaptureText(event.target.value)}
                placeholder="Paste a note, decision, meeting fragment, bookmark, or idea..."
                className="min-h-40 w-full resize-none border border-hairline bg-surface-inset p-3 text-sm leading-6 text-ink-50 placeholder:text-ink-600 focus:border-synapse/50"
              />
              <button
                type="submit"
                disabled={isPending || captureText.trim().length < 3}
                className="inline-flex h-10 w-full items-center justify-center gap-2 bg-synapse px-3 font-mono text-sm font-bold uppercase tracking-wide text-void transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                title="Capture memory"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
                Capture
              </button>
            </form>
          </section>

          <section className="border border-hairline bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-200">Pinned</h2>
              <Sparkles className="h-4 w-4 text-signal" />
            </div>
            <div className="thin-scrollbar mt-3 max-h-[330px] space-y-2 overflow-auto pr-1">
              {importantNodes.slice(0, 5).map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => focusGraph(node.id)}
                  className="block w-full border border-hairline bg-surface-inset p-2 text-left transition-colors hover:border-synapse/40"
                  title="Focus graph"
                >
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-blueprint">
                    {node.nodeType}
                  </span>
                  <span className="mt-1 block truncate text-sm font-semibold text-ink-50">{node.title}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="border border-hairline bg-surface p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-synapse">Graph workspace</p>
                  <h2 className="mt-1 truncate font-display text-lg font-bold text-ink-50 text-balance">
                    {topNode?.title ?? "Knowledge graph"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => refreshStatus()}
                  className="inline-flex h-9 items-center justify-center gap-2 border border-hairline bg-surface-inset px-3 font-mono text-xs font-bold uppercase tracking-wide text-ink-200 transition-colors hover:border-synapse/40 hover:text-synapse"
                  title="Refresh status"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
              <GraphCanvas graph={graph} onFocus={focusGraph} className="mt-3 h-[420px] lg:h-[520px]" />
            </section>

            <section className="border border-hairline bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-200">Ask</h2>
                <Send className="h-4 w-4 text-coral" />
              </div>
              <form onSubmit={submitQuestion} className="mt-3 space-y-2">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="min-h-28 w-full resize-none border border-hairline bg-surface-inset p-3 text-sm leading-6 text-ink-50"
                />
                <button
                  type="submit"
                  disabled={isPending || question.trim().length < 3}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 bg-coral px-3 font-mono text-sm font-bold uppercase tracking-wide text-void transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Ask Synapse"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                  Ask
                </button>
              </form>
              <div className="mt-3 min-h-40 border border-hairline bg-surface-inset p-3">
                {answer ? (
                  <p className="text-sm leading-6 text-ink-200">{answer.answer}</p>
                ) : (
                  <p className="text-sm leading-6 text-ink-600">
                    The answer panel will use the current graph and retrieval evidence.
                  </p>
                )}
              </div>
              {notice ? (
                <div
                  className={cn(
                    "mt-3 flex animate-fade-up items-start gap-2 border p-2 text-sm font-medium",
                    noticeIsPositive ? "border-synapse/30 bg-synapse-soft text-synapse" : "border-signal/30 bg-signal-soft text-signal"
                  )}
                >
                  {noticeIsPositive ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{notice}</span>
                </div>
              ) : null}
            </section>
          </div>

          <section className="border border-hairline bg-surface p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-synapse">Hybrid retrieval</p>
                <h2 className="mt-1 font-display text-lg font-bold text-ink-50">Evidence</h2>
              </div>
              <form onSubmit={submitSearch} className="flex w-full gap-2 sm:max-w-xl">
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="h-10 min-w-0 flex-1 border border-hairline bg-surface-inset px-3 text-sm font-medium text-ink-50 focus:border-synapse/50"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 w-10 items-center justify-center bg-synapse text-void transition-opacity hover:opacity-90"
                  title="Search"
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {(hits.length ? hits : recentMemories).slice(0, 6).map((node) => (
                <MemoryCard key={node.id} node={node} compact onFocus={focusGraph} />
              ))}
            </div>
          </section>
        </section>

        <section className="space-y-3">
          <StatusPanel status={status} metrics={metrics} />
          <section className="border border-hairline bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-200">Recent</h2>
              <Network className="h-4 w-4 text-blueprint" />
            </div>
            <div className="thin-scrollbar mt-3 max-h-[640px] space-y-3 overflow-auto pr-1">
              {recentMemories.length ? (
                recentMemories.map((node) => <MemoryCard key={node.id} node={node} compact onFocus={focusGraph} />)
              ) : (
                <div className="border border-hairline bg-surface-inset p-3 text-sm text-ink-600">
                  No memories available.
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}