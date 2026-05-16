/** Backend API client — all requests go through the Vite dev proxy at /api. */

const BASE = "/api";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---- Types ----------------------------------------------------------------

export interface ProjectOut {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface FileMetadata {
  id: string;
  project_id: string;
  filename: string;
  size_bytes: number;
  content_type: string;
  uploaded_at: string;
}

export interface DownloadUrl {
  url: string;
  expires_in: number;
}

// ---- Auth -----------------------------------------------------------------

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse<{ access_token: string }>(res);
  return data.access_token;
}

// ---- Projects -------------------------------------------------------------

export async function listProjects(
  token: string,
  skip = 0,
  limit = 50,
): Promise<ProjectOut[]> {
  const res = await fetch(
    `${BASE}/projects?skip=${skip}&limit=${limit}`,
    { headers: authHeaders(token) },
  );
  return handleResponse<ProjectOut[]>(res);
}

export async function createProject(
  token: string,
  name: string,
): Promise<ProjectOut> {
  const res = await fetch(`${BASE}/projects`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return handleResponse<ProjectOut>(res);
}

// ---- Files ----------------------------------------------------------------

export async function listFiles(
  token: string,
  projectId: string,
  skip = 0,
  limit = 50,
): Promise<FileMetadata[]> {
  const res = await fetch(
    `${BASE}/files/${projectId}?skip=${skip}&limit=${limit}`,
    { headers: authHeaders(token) },
  );
  return handleResponse<FileMetadata[]>(res);
}

export async function uploadFile(
  token: string,
  projectId: string,
  file: File,
): Promise<FileMetadata> {
  const form = new FormData();
  form.append("upload_file", file);
  const res = await fetch(`${BASE}/files/upload?project_id=${projectId}`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  return handleResponse<FileMetadata>(res);
}

export async function deleteFile(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${BASE}/files/${fileId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
}

export async function getDownloadUrl(
  token: string,
  projectId: string,
  fileId: string,
): Promise<DownloadUrl> {
  const res = await fetch(`${BASE}/files/${projectId}/${fileId}/download`, {
    headers: authHeaders(token),
  });
  return handleResponse<DownloadUrl>(res);
}
