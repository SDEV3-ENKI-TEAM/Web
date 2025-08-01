import { Stats } from "@/types/event";

export async function fetchStats(): Promise<Stats> {
  const response = await fetch("/api/dashboard-stats");
  if (!response.ok) {
    throw new Error("Failed to fetch stats from backend");
  }
  return await response.json();
}
