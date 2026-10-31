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
  type OrganizationSummary,
  type ProjectSummary,
  type ScanSummary,
} from "@/lib/api";
import { formatDate, gradeColor, statusColor } from "@/lib/format";

export default function DashboardPage() {
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [recentScans, setRecentScans] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let current = getStoredOrg();
        if (!current) {
          const orgs = await organizations.list();
          current = orgs[0] ?? null;
        }
        if (cancelled) return;
        setOrg(current);

        if (current) {
          const projs = await projects.list(current.id);
          if (cancelled) return;
          setProjectList(projs);

          const allScans: ScanSummary[] = [];
          for (const p of projs.slice(0, 5)) {
            try {
              const list = await scans.listByProject(p.id);
              allScans.push(...list);
            } catch {
              /* ignore per-project errors */
            }
          }
          allScans.sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime(),
          );
          if (!cancelled) setRecentScans(allScans.slice(0, 8));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
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
        title="Dashboard"
        description={
          org
            ? `Workspace: ${org.name}`
            : "Overview of projects and recent scans"
        }
        actions={
          <Link
            href="/projects"
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            View projects
          </Link>
        }
      />

      {error ? (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Projects
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {loading ? "—" : projectList.length}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Recent scans
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {loading ? "—" : recentScans.length}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Avg score
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {loading
              ? "—"
              : recentScans.filter((s) => s.score != null).length
                ? Math.round(
                    recentScans
                      .filter((s) => s.score != null)
                      .reduce((a, s) => a + (s.score || 0), 0) /
                      recentScans.filter((s) => s.score != null).length,
                  )
                : "—"}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Projects" subtitle="Your active projects" />
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading…</p>
          ) : projectList.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Create a project to start scanning websites."
              action={
                <Link
                  href="/projects"
                  className="text-sm font-medium text-brand-600"
                >
                  Go to projects →
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {projectList.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.websiteCount ?? 0} websites · {p.scanCount ?? 0}{" "}
                        scans
                      </p>
                    </div>
                    <span className="text-slate-400">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent scans" subtitle="Latest activity" />
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading…</p>
          ) : recentScans.length === 0 ? (
            <EmptyState
              title="No scans yet"
              description="Queue a scan from a project’s website list."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentScans.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/scans/${s.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {s.website?.name || s.websiteId}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(s.createdAt || s.queuedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.grade ? (
                        <Badge className={gradeColor(s.grade)}>
                          {s.grade}
                        </Badge>
                      ) : null}
                      <Badge className={statusColor(s.status)}>
                        {s.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
