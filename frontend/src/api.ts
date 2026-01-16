export type DashboardBody = {
  id: string;
  label: string;
  value: number;
};

export type DashboardAchievement = {
  id: string;
  title: string;
};

export type DashboardResponse = {
  hero_name: string;
  level: number;
  flow_today: number;
  practice_of_the_day: {
    title: string;
    duration_minutes: number;
  };
  bodies: DashboardBody[];
  achievements: DashboardAchievement[];
};

export type Trail = {
  id: string;
  icon: string;
  title: string;
  modules: string[];
  duration_weeks_min: number;
  duration_weeks_max: number;
  format: string;
  enrolled?: boolean;
};

export type TrailListResponse = {
  trails: Trail[];
};

export type VideoLesson = {
  id: string;
  title: string;
  provider: string;
  url: string;
  duration_minutes: number;
  completed?: boolean;
};

export type TrailVideosResponse = {
  trail_id: string;
  videos: VideoLesson[];
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const AUTH_TOKEN_STORAGE_KEY = "auth-token";

export type User = {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  xp: number;
  streak: number;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type MeResponse = {
  user: User;
};

export type ProgressResponse = {
  user: User;
  enrolled_trails: string[];
  completed_videos: number;
  per_trail: Record<string, { total_videos: number; completed_videos: number }>;
};

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? "";
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

function cacheKey(path: string) {
  const token = getAuthToken();
  const scope = token ? "auth" : "anon";
  return `api-cache:${scope}:${path}`;
}

function readCache<T>(path: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(path));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCache<T>(path: string, data: T) {
  try {
    localStorage.setItem(cacheKey(path), JSON.stringify(data));
  } catch {
    return;
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = getAuthToken();
  try {
    const response = await fetch(url, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) {
      throw new Error(`Erro ao carregar ${path}`);
    }
    const data = (await response.json()) as T;
    writeCache(path, data);
    return data;
  } catch (error) {
    const cached = readCache<T>(path);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function postJson<TResponse>(
  path: string,
  body: unknown,
  options?: { auth?: boolean }
) {
  const url = `${API_BASE_URL}${path}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (options?.auth && token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return (await response.json()) as TResponse;
}

export function getDashboard() {
  return fetchJson<DashboardResponse>("/api/dashboard");
}

export function getTrails() {
  return fetchJson<TrailListResponse>("/api/trails");
}

export function getTrailVideos(trailId: string) {
  return fetchJson<TrailVideosResponse>(`/api/trails/${trailId}/videos`);
}

export async function signup(payload: { email: string; password: string; name?: string }) {
  return postJson<AuthResponse>("/api/auth/signup", payload);
}

export async function login(payload: { email: string; password: string }) {
  return postJson<AuthResponse>("/api/auth/login", payload);
}

export async function getMe() {
  return fetchJson<MeResponse>("/api/me");
}

export async function enrollTrail(trailId: string) {
  return postJson<{ status: string; enrollment_id?: string }>(
    `/api/trails/${trailId}/enroll`,
    {},
    { auth: true }
  );
}

export async function addTrailVideo(
  trailId: string,
  payload: Pick<VideoLesson, "title" | "url" | "duration_minutes"> & {
    provider?: string;
  }
) {
  const data = await postJson<{ video: VideoLesson }>(
    `/api/trails/${trailId}/videos`,
    payload,
    { auth: true }
  );
  return data.video;
}

export async function completeVideo(videoId: string) {
  return postJson<{ status: string; user: User }>(
    `/api/videos/${videoId}/complete`,
    {},
    { auth: true }
  );
}

export async function getProgress() {
  return fetchJson<ProgressResponse>("/api/progress");
}

export async function adminCreateTrail(payload: {
  id: string;
  title: string;
  icon?: string;
  format: string;
  duration_weeks_min: number;
  duration_weeks_max: number;
  modules: string[];
}) {
  return postJson<{ trail: Trail }>("/api/admin/trails", payload, { auth: true });
}
