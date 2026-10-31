"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
} from "@/components/ui";
import {
  ApiError,
  getStoredOrg,
  organizations,
  projects,
  type OrganizationSummary,
  type ProjectSummary,
} from "@/lib/api";

export default function ProjectsPage() {
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [list, setList] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      let current = getStoredOrg();
      if (!current) {
        const orgs = await organizations.list();
        current = orgs[0] ?? null;
      }
      setOrg(current);
      if (current) {
        setList(await projects.list(current.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    setCreating(true);
    setError(null);
    try {
      await projects.create({
        organizationId: org.id,
        name,
        description: description || undefined,
      });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to create project",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Group websites and scans under a project"
      />

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="All projects" />
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading…</p>
          ) : list.length === 0 ? (
            <EmptyState
              title="No projects"
              description="Create your first project to add websites and run scans."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{p.name}</p>
                      {p.description ? (
                        <p className="mt-0.5 text-sm text-slate-500">
                          {p.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">
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
          <CardHeader title="New project" />
          <form onSubmit={onCreate} className="space-y-3 p-5">
            <Input
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marketing site"
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
            <Button
              type="submit"
              disabled={creating || !org || !name.trim()}
              className="w-full"
            >
              {creating ? "Creating…" : "Create project"}
            </Button>
            {!org ? (
              <p className="text-xs text-amber-600">
                No organization found. Register again or create one under
                Organizations.
              </p>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  );
}
