"use client";

import { FormEvent, useEffect, useState } from "react";
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
  organizations,
  type OrganizationSummary,
} from "@/lib/api";

export default function OrganizationsPage() {
  const [list, setList] = useState<OrganizationSummary[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setList(await organizations.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await organizations.create({ name });
      setName("");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to create organization",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Workspaces you belong to"
      />
      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Your organizations" />
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading…</p>
          ) : list.length === 0 ? (
            <EmptyState title="No organizations" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">{o.name}</p>
                    <p className="text-xs text-slate-500">/{o.slug}</p>
                  </div>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                    {o.role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Create organization" />
          <form onSubmit={onCreate} className="space-y-3 p-5">
            <Input
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Agency"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={creating || !name.trim()}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
