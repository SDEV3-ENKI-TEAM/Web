import { Event, EventDetail, Stats } from "@/types/event";

const API_BASE_URL = "http://localhost:9200";

export async function fetchEvents(): Promise<Event[]> {
  const response = await fetch("/api/dashboard");
  if (!response.ok) {
    throw new Error("Failed to fetch events from backend");
  }
  const data = await response.json();
  return data.events;
}

export async function fetchStats(): Promise<Stats> {
  const response = await fetch("/api/dashboard-stats");
  if (!response.ok) {
    throw new Error("Failed to fetch stats from backend");
  }
  return await response.json();
}
