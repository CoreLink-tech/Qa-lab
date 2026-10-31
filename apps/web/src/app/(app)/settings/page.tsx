"use client";

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
  apiKeys,
  getStoredOrg,
  organizations,
  type ApiKeySummary,
  type OrganizationSummary,
} from "@/lib/api";

export default function SettingsPage() {
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      let current = getStoredOrg();
      if (!current) {
        const orgs = await organizations.list();
        current = orgs[0] ?? null;
      }
      setOrg(current);
      if (current) {
        setKeys(await apiKeys.list(current.id));
      }
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
    if (!org) return;
    setError(null);
    setNewKey(null);
    try {
      const result = await apiKeys.create({
        organizationId: org.id,
        name,
      });
      setNewKey(result.key);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create key");
    }
  }

  async function onRevoke(id: string) {
    try {
      await apiKeys.revoke(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke");
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="API keys for CI and programmatic access"
      />
      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {newKey ? (
        <div className="mb-4">
          <Alert variant="info">
            <p className="font-medium">Copy your API key now — it won&apos;t be shown again.</p>
            <code className="mt-2 block break-all rounded bg-white/50 p-2 text-xs">
              {newKey}
            </code>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="API keys" />
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading…</p>
          ) : keys.length === 0 ? (
            <EmptyState title="No API keys" description="Create a key for CI pipelines." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">{k.name}</p>
                    <p className="text-xs text-slate-500">
                      Starts with {k.prefix}… · scopes: {k.scopes?.join(", ")}
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => onRevoke(k.id)}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Create key" />
          <form onSubmit={onCreate} className="space-y-3 p-5">
            <Input
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CI pipeline"
            />
            <Button type="submit" className="w-full" disabled={!org || !name.trim()}>
              Create API key
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
