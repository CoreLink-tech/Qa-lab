export function gradeColor(grade?: string | null): string {
  switch (grade) {
    case "A":
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case "B":
      return "text-lime-700 bg-lime-50 border-lime-200";
    case "C":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "D":
      return "text-orange-700 bg-orange-50 border-orange-200";
    case "F":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-slate-600 bg-slate-50 border-slate-200";
  }
}

export function statusColor(status?: string): string {
  switch (status) {
    case "COMPLETED":
      return "text-emerald-700 bg-emerald-50";
    case "RUNNING":
      return "text-blue-700 bg-blue-50";
    case "QUEUED":
      return "text-slate-700 bg-slate-100";
    case "FAILED":
      return "text-red-700 bg-red-50";
    case "CANCELLED":
      return "text-amber-700 bg-amber-50";
    default:
      return "text-slate-600 bg-slate-50";
  }
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
