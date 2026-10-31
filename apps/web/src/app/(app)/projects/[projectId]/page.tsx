"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
} from "@/components/ui";
import {
  ApiError,
  projects,
  scans,
  schedules,
  websites,
  type ProjectSummary,
  type ScanSummary,
  type WebsiteSummary,
} from "@/lib/api";
import { formatDate, gradeColor, statusColor } from "@/lib/format";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = String(params.projectId);

  const [project, setProject] = useState<
    (ProjectSummary & { websites: WebsiteSummary[] }) | null
  >(null);
  const [scanList, setScanList] = useState<ScanSummary[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await projects.get(projectId);
      setProject(p);
      const s = await scans.listByProject(projectId);
      setScanList(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAddWebsite(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await websites.create({ projectId, name, url });
      setName("");
      setUrl("");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to add website",
      );
    } finally {
      setAdding(false);
    }
  }

  async function onSchedule(websiteId: string) {
    setError(null);
    try {
      await schedules.create({ websiteId, intervalHours: 24, maxPages: 30 });
      setError(null);
      alert("Daily schedule created for this website.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create schedule");
    }
  }

  async function onStartScan(websiteId: string) {
    setScanningId(websiteId);
    setError(null);
    try {
      await scans.create({
        websiteId,
        maxPages: 30,
        maxDepth: 2,
      });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to queue scan",
      );
    } finally {
      setScanningId(null);
    }
  }

  if (loading && !project) {
    return <p className="text-sm text-slate-500">Loading project…</p>;
  }

  if (!project) {
    return <Alert>Project not found</Alert>;
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.description || "Project detail"}
        actions={
          <Link
            href="/projects"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← All projects
          </Link>
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Websites"
              subtitle="Add a site and run a scan"
            />
            {(project.websites || []).length === 0 ? (
              <EmptyState
                title="No websites"
                description="Add the first URL for this project."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {(project.websites || []).map((w) => (
                  <li
                    key={w.id}
                    className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{w.name}</p>
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-brand-600 hover:underline"
                      >
                        {w.url}
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={scanningId === w.id}
                        onClick={() => onStartScan(w.id)}
                      >
                        {scanningId === w.id ? "Queueing…" : "Run scan"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => onSchedule(w.id)}
                      >
                        Schedule daily
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Scans" subtitle="Recent runs for this project" />
            {scanList.length === 0 ? (
              <EmptyState title="No scans yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {scanList.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/scans/${s.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {s.website?.name || s.websiteId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(s.createdAt || s.queuedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
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

        <Card>
          <CardHeader title="Add website" />
          <form onSubmit={onAddWebsite} className="space-y-3 p-5">
            <Input
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Homepage"
            />
            <Input
              label="URL"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={adding || !name.trim() || !url.trim()}
            >
              {adding ? "Adding…" : "Add website"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
