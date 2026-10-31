"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import {
  getStoredOrg,
  organizations,
  projects,
  scans,
  type ScanSummary,
} from "@/lib/api";
import { formatDate, gradeColor, statusColor } from "@/lib/format";

export default function ScansPage() {
  const [list, setList] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let org = getStoredOrg();
        if (!org) {
          const orgs = await organizations.list();
          org = orgs[0] ?? null;
        }
        if (!org) {
          if (!cancelled) setLoading(false);
          return;
        }
        const projs = await projects.list(org.id);
        const all: ScanSummary[] = [];
        for (const p of projs) {
          try {
            all.push(...(await scans.listByProject(p.id)));
          } catch {
            /* ignore */
          }
        }
        all.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        if (!cancelled) setList(all);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load scans");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Scans"
        description="All scan runs across your projects"
      />
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      <Card>
        <CardHeader title="History" />
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState
            title="No scans"
            description="Start a scan from a project website."
            action={
              <Link href="/projects" className="text-sm text-brand-600">
                Go to projects →
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Website</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/scans/${s.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {s.website?.name || s.website?.url || s.websiteId}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={statusColor(s.status)}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {s.grade ? (
                        <Badge className={gradeColor(s.grade)}>
                          {s.score ?? "—"} ({s.grade})
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {formatDate(s.createdAt || s.queuedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
