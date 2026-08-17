import { NextResponse } from "next/server";

// Proxies course search to golfcourseapi.com so the API key stays on the server.
// Set GOLF_COURSE_API_KEY in Vercel (Project -> Settings -> Environment Variables).

const API_BASE = "https://api.golfcourseapi.com";

type ApiCourse = {
  id?: string | number;
  club_name?: string;
  course_name?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  latitude?: number;
  longitude?: number;
};

function displayName(c: ApiCourse): string {
  const club = (c.club_name || "").trim();
  const course = (c.course_name || "").trim();
  if (!club) return course || "Unknown course";
  if (!course || course.toLowerCase() === club.toLowerCase()) return club;
  return `${club} (${course})`;
}

function locationText(c: ApiCourse): string {
  const l = c.location || {};
  return [l.city, l.state, l.country].filter(Boolean).join(", ");
}

function coords(c: ApiCourse): { lat: number | null; lng: number | null } {
  const l = c.location || {};
  const lat = l.latitude ?? l.lat ?? c.latitude ?? null;
  const lng = l.longitude ?? l.lng ?? c.longitude ?? null;
  return {
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
  };
}

async function callApi(query: string, key: string, scheme: "Key" | "Bearer") {
  return fetch(
    `${API_BASE}/v1/search?search_query=${encodeURIComponent(query)}`,
    {
      headers: { Authorization: `${scheme} ${key}` },
      // Course data changes rarely; cache identical searches for a day to save quota.
      next: { revalidate: 86400 },
    }
  );
}

export async function GET(request: Request) {
  const key = process.env.GOLF_COURSE_API_KEY;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (!key) return NextResponse.json({ configured: false, courses: [] });
  if (q.length < 2) return NextResponse.json({ configured: true, courses: [] });

  try {
    let res = await callApi(q, key, "Key");
    if (res.status === 401) res = await callApi(q, key, "Bearer");
    if (!res.ok) {
      return NextResponse.json(
        { configured: true, courses: [], error: `Course database returned ${res.status}` },
        { status: 200 }
      );
    }
    const data = await res.json();
    const list: ApiCourse[] = Array.isArray(data?.courses) ? data.courses : [];
    const courses = list.slice(0, 10).map((c) => {
      const { lat, lng } = coords(c);
      return {
        id: c.id ?? null,
        name: displayName(c),
        location: locationText(c),
        address: c.location?.address || "",
        lat,
        lng,
      };
    });
    return NextResponse.json({ configured: true, courses });
  } catch {
    return NextResponse.json(
      { configured: true, courses: [], error: "Could not reach the course database" },
      { status: 200 }
    );
  }
}
