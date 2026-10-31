"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Alert, Button, Card, Input } from "@/components/ui";
import { ApiError, register } from "@/lib/api";
import { validateEmail, validatePassword } from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    organizationName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const emailErr = validateEmail(form.email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    const passErr = validatePassword(form.password);
    if (passErr) {
      setError(passErr);
      return;
    }
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName || undefined,
        organizationName: form.organizationName || undefined,
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to create account",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            QA
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Create your QA Lab account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A personal workspace is created automatically
          </p>
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {error ? <Alert>{error}</Alert> : null}
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
            <Input
              label="First name"
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
            />
            <Input
              label="Organization name (optional)"
              placeholder="Acme Agency"
              value={form.organizationName}
              onChange={(e) => update("organizationName", e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
