const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/session`, {
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { authenticated?: boolean };
    return data.authenticated === true;
  } catch {
    return false;
  }
}

export async function loginAdmin(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Login failed." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Could not reach the API server." };
  }
}

export async function logoutAdmin(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // best-effort
  }
}
