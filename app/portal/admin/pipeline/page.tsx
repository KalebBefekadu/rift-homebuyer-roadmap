"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BUCKET_LABELS, STAGE_LABELS } from "@/lib/roadmap/constants";
import type { ClientStage, TimeToBuy } from "@/lib/roadmap/types";
import { listClients, updateClientMeta, type StoredClient } from "@/lib/store/local";

export default function PipelinePage() {
  const [clients, setClients] = useState<StoredClient[]>([]);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [bucketFilter, setBucketFilter] = useState<string>("all");

  const refresh = () => setClients(listClients());

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (bucketFilter !== "all" && c.timeToBuy !== bucketFilter) return false;
      return true;
    });
  }, [clients, stageFilter, bucketFilter]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--app-panel)]">Pipeline</h1>
          <p className="mt-1 text-sm text-[#a8aea4]">Clients saved from roadmap intakes live here.</p>
        </div>
        <Link
          href="/portal/admin/roadmap/new"
          className="rounded-[10px] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#1a1408] no-underline hover:brightness-110"
        >
          New roadmap
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="max-w-[220px]"
        >
          <option value="all">All stages</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={bucketFilter}
          onChange={(e) => setBucketFilter(e.target.value)}
          className="max-w-[180px]"
        >
          <option value="all">All buckets</option>
          {Object.entries(BUCKET_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center text-[#c5cbc0]">
          <p className="mb-3 text-sm">No clients yet.</p>
          <Link href="/portal/admin/roadmap/new" className="text-[var(--accent)] no-underline hover:underline">
            Run your first intake →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--app-panel)]">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Bucket</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--ink)]">
                      {c.firstName} {c.lastName}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={c.stage}
                      onChange={(e) => {
                        updateClientMeta(c.id, { stage: e.target.value as ClientStage });
                        refresh();
                      }}
                      className="max-w-[160px] text-xs"
                    >
                      {Object.entries(STAGE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={c.timeToBuy}
                      onChange={(e) => {
                        updateClientMeta(c.id, { timeToBuy: e.target.value as TimeToBuy });
                        refresh();
                      }}
                      className="max-w-[130px] text-xs"
                    >
                      {Object.entries(BUCKET_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(c.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/admin/roadmap/${c.id}`}
                      className="font-semibold text-[var(--brand)] no-underline hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
