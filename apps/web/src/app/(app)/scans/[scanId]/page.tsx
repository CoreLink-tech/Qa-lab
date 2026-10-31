"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
} from "@/components/ui";
import { ApiError, scans, type ScanDetail } from "@/lib/api";
import { formatDate, gradeColor, statusColor } from "@/lib/format";

type Finding = {
  ruleId?: string;
  severity?: string;
  message?: string;
  category?: string;
  url?: string;
};

export default function ScanDetailPage() {
  const params = useParams();
  const scanId = String(params.scanId);
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await scans.get(scanId);
      setScan(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scan");
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while in progress
  useEffect(() => {
    if (!scan) return;
    if (scan.status !== "QUEUED" && scan.status !== "RUNNING") return;
    const t = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(t);
  }, [scan, load]);

  async function onCancel() {
    setCancelling(true);
    try {
      await scans.cancel(scanId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  if (loading && !scan) {
    return <p className="text-sm text-slate-500">Loading scan…</p>;
  }

  if (!scan) {
    return <Alert>Scan not found</Alert>;
  }

  const reportJson = scan.report?.reportJson as
    | { findings?: Finding[]; recommendations?: unknown[] }
    | undefined;
  const findings = Array.isArray(reportJson?.findings)
    ? reportJson!.findings!
    : [];

  return (
    <div>
      <PageHeader
        title="Scan detail"
        description={scan.website?.url || scan.websiteId}
        actions={
          <div className="flex items-center gap-2">
            {scan.report?.reportJson ? (
              <Button
                variant="secondary"
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify(scan.report?.reportJson, null, 2)],
                    { type: "application/json" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `qa-lab-scan-${scanId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download JSON
              </Button>
            ) : null}
            {(scan.status === "QUEUED" || scan.status === "RUNNING") && (
              <Button
                variant="danger"
                disabled={cancelling}
                onClick={onCancel}
              >
                {cancelling ? "Cancelling…" : "Cancel"}
              </Button>
            )}
            <Link
              href="/scans"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← All scans
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Status</p>
          <div className="mt-2">
            <Badge className={statusColor(scan.status)}>{scan.status}</Badge>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Score</p>
          <p className="mt-2 text-2xl font-semibold">
            {scan.report?.score ?? "—"}
            {scan.report?.grade ? (
              <span className="ml-2 text-base">
                <Badge className={gradeColor(scan.report.grade)}>
                  {scan.report.grade}
                </Badge>
              </span>
            ) : null}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-500">
            Pages scanned
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {scan.pagesScanned ?? "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Issues</p>
          <p className="mt-2 text-2xl font-semibold">
            {scan.report?.issueCount ?? findings.length}
          </p>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <span className="text-slate-400">Queued</span>
          <br />
          {formatDate(scan.queuedAt)}
        </div>
        <div>
          <span className="text-slate-400">Started</span>
          <br />
          {formatDate(scan.startedAt)}
        </div>
        <div>
          <span className="text-slate-400">Completed</span>
          <br />
          {formatDate(scan.completedAt)}
        </div>
      </div>

      {scan.error ? (
        <div className="mb-6">
          <Alert>{scan.error}</Alert>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Findings"
          subtitle={
            findings.length
              ? `${findings.length} issues detected`
              : "No findings in report yet"
          }
        />
        {findings.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            {scan.status === "RUNNING" || scan.status === "QUEUED"
              ? "Scan in progress — findings will appear when complete."
              : "No findings recorded."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {findings.slice(0, 100).map((f, i) => (
              <li key={i} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {f.severity ? (
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                      {f.severity}
                    </Badge>
                  ) : null}
                  {f.category ? (
                    <Badge className="border-brand-100 bg-brand-50 text-brand-800">
                      {f.category}
                    </Badge>
                  ) : null}
                  {f.ruleId ? (
                    <span className="text-xs text-slate-400">{f.ruleId}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-800">
                  {f.message || "Issue"}
                </p>
                {f.url ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {f.url}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
