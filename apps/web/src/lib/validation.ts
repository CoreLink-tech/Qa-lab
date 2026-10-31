/** Client-side checks aligned with API password policy. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password is too long";
  if (!/[a-z]/.test(password)) return "Password needs a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Password needs an uppercase letter";
  if (!/\d/.test(password)) return "Password needs a number";
  return null;
}

export function validateEmail(email: string): string | null {
  const t = email.trim();
  if (!t) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Enter a valid email";
  return null;
}

export function validateUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return "URL is required";
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "URL must be http or https";
    }
    if (!u.hostname.includes(".")) {
      return "URL must include a valid hostname";
    }
  } catch {
    return "Enter a valid URL";
  }
  return null;
}
