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

export interface MemberOut {
  project_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
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
  const res = await fetch(`${BASE}/projects?skip=${skip}&limit=${limit}`, {
    headers: authHeaders(token),
  });
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

// ---- Alignments -----------------------------------------------------------

export interface IpPointApiOut {
  id: string;
  alignment_id: string;
  seq: number;
  x: number;
  z: number;
  radius: number;
}

export interface AlignmentApiOut {
  id: string;
  project_id: string;
  name: string;
  design_speed: number;
  created_at: string;
  ip_points: IpPointApiOut[];
}

export async function listAlignments(
  token: string,
  projectId: string,
): Promise<AlignmentApiOut[]> {
  const res = await fetch(`${BASE}/projects/${projectId}/alignments`, {
    headers: authHeaders(token),
  });
  return handleResponse<AlignmentApiOut[]>(res);
}

export async function createAlignment(
  token: string,
  projectId: string,
  name: string,
  designSpeed: number,
): Promise<AlignmentApiOut> {
  const res = await fetch(`${BASE}/projects/${projectId}/alignments`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name, design_speed: designSpeed }),
  });
  return handleResponse<AlignmentApiOut>(res);
}

export async function deleteAlignment(
  token: string,
  projectId: string,
  alignmentId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/alignments/${alignmentId}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
}

export async function replaceIpPoints(
  token: string,
  projectId: string,
  alignmentId: string,
  points: Array<{ seq: number; x: number; z: number; radius: number }>,
): Promise<IpPointApiOut[]> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/alignments/${alignmentId}/ip-points`,
    {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(points),
    },
  );
  return handleResponse<IpPointApiOut[]>(res);
}

// ---- Vertical Alignments --------------------------------------------------

export interface VipApiOut {
  id: string;
  vertical_alignment_id: string;
  seq: number;
  station: number;
  elevation: number;
  vc_length: number;
}

export interface VerticalAlignmentApiOut {
  id: string;
  alignment_id: string;
  name: string;
  created_at: string;
  vips: VipApiOut[];
}

export async function listVerticals(
  token: string,
  projectId: string,
  alignmentId: string,
): Promise<VerticalAlignmentApiOut[]> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/alignments/${alignmentId}/verticals`,
    { headers: authHeaders(token) },
  );
  return handleResponse<VerticalAlignmentApiOut[]>(res);
}

export async function createVertical(
  token: string,
  projectId: string,
  alignmentId: string,
  name: string,
): Promise<VerticalAlignmentApiOut> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/alignments/${alignmentId}/verticals`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  return handleResponse<VerticalAlignmentApiOut>(res);
}

export async function deleteVertical(
  token: string,
  projectId: string,
  alignmentId: string,
  verticalId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/alignments/${alignmentId}/verticals/${verticalId}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
}

export async function replaceVips(
  token: string,
  projectId: string,
  alignmentId: string,
  verticalId: string,
  vips: Array<{
    seq: number;
    station: number;
    elevation: number;
    vc_length: number;
  }>,
): Promise<VipApiOut[]> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/alignments/${alignmentId}/verticals/${verticalId}/vips`,
    {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(vips),
    },
  );
  return handleResponse<VipApiOut[]>(res);
}

// ---- Project Members ------------------------------------------------------

export async function listMembers(
  token: string,
  projectId: string,
): Promise<MemberOut[]> {
  const res = await fetch(`${BASE}/projects/${projectId}/members`, {
    headers: authHeaders(token),
  });
  return handleResponse<MemberOut[]>(res);
}

export async function addMember(
  token: string,
  projectId: string,
  userId: string,
  role: "owner" | "editor" | "viewer",
): Promise<MemberOut> {
  const res = await fetch(`${BASE}/projects/${projectId}/members`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, role }),
  });
  return handleResponse<MemberOut>(res);
}

export async function removeMember(
  token: string,
  projectId: string,
  userId: string,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
}

// ---- Projects (delete) ----------------------------------------------------

export async function deleteProject(
  token: string,
  projectId: string,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
}
