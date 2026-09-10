import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPlanName(plan?: string): string {
  if (!plan) return "Free";
  const p = String(plan).trim();
  if (!p || p.toLowerCase() === "free") return "Free";
  if (p.toLowerCase() === "vip") return "VIP";
  if (p.toLowerCase() === "standard") return "Standard";
  if (p.toLowerCase() === "premium") return "Premium";
  if (p.toLowerCase() === "basic") return "Basic";
  return p
    .split(" ")
    .map((w) => (w.toLowerCase() === "vip" ? "VIP" : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function clearAppAuthSession(queryClient?: any) {
  const keysToRemove = [
    "appUser",
    "user",
    "appAccessToken",
    "accessToken",
    "refreshToken",
    "ott_active_profile",
  ];
  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });

  if (queryClient) {
    try {
      queryClient.clear();
    } catch {}
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("user-updated"));
    window.dispatchEvent(new Event("profile-changed"));
    window.dispatchEvent(new Event("storage"));
  }
}

