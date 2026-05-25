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
  description: string | null;
  owner_id: string;
  created_at: string;
}

export interface MemberOut {
  project_id: string;
  user_id: string;
  email: string;
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

// ---- User profile ----------------------------------------------------------

export interface UserMePatch {
  email?: string;
  current_password?: string;
  new_password?: string;
}

export interface UserMeOut {
  id: string;
  email: string;
  role: string;
}

export async function patchUserMe(token: string, body: UserMePatch): Promise<UserMeOut> {
  const res = await fetch(`${BASE}/users/me`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<UserMeOut>(res);
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
  description?: string,
): Promise<ProjectOut> {
  const res = await fetch(`${BASE}/projects`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description ?? null }),
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

export async function renameFile(
  token: string,
  fileId: string,
  name: string,
): Promise<FileMetadata> {
  const res = await fetch(`${BASE}/files/${fileId}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ filename: name }),
  });
  return handleResponse<FileMetadata>(res);
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

// ---- Multipart upload -----------------------------------------------------

export interface MultipartInitResponse {
  upload_id: string;
  s3_key: string;
  part_urls: string[];
  expires_in: number;
}

export interface MultipartPart {
  part_number: number;
  etag: string;
}

export async function multipartInit(
  token: string,
  projectId: string,
  filename: string,
  contentType: string,
  totalSizeBytes: number,
  partCount: number,
): Promise<MultipartInitResponse> {
  const res = await fetch(`${BASE}/files/multipart/init?project_id=${projectId}`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      filename,
      content_type: contentType,
      total_size_bytes: totalSizeBytes,
      part_count: partCount,
    }),
  });
  return handleResponse<MultipartInitResponse>(res);
}

export async function multipartComplete(
  token: string,
  projectId: string,
  uploadId: string,
  s3Key: string,
  filename: string,
  totalSizeBytes: number,
  contentType: string,
  parts: MultipartPart[],
): Promise<FileMetadata> {
  const res = await fetch(`${BASE}/files/multipart/complete?project_id=${projectId}`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_id: uploadId,
      s3_key: s3Key,
      filename,
      total_size_bytes: totalSizeBytes,
      content_type: contentType,
      parts,
    }),
  });
  return handleResponse<FileMetadata>(res);
}

export async function multipartAbort(
  token: string,
  uploadId: string,
  s3Key: string,
): Promise<void> {
  const res = await fetch(`${BASE}/files/multipart/abort`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ upload_id: uploadId, s3_key: s3Key }),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
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

// ---- Projects (update) ----------------------------------------------------

export async function updateProject(
  token: string,
  projectId: string,
  name: string,
  description?: string | null,
): Promise<ProjectOut> {
  const res = await fetch(`${BASE}/projects/${projectId}`, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description ?? null }),
  });
  return handleResponse<ProjectOut>(res);
}

// ---- Users ----------------------------------------------------------------

export interface UserLookupOut {
  id: string;
  email: string;
}

export async function lookupUserByEmail(
  token: string,
  email: string,
): Promise<UserLookupOut> {
  const res = await fetch(
    `${BASE}/users/lookup?email=${encodeURIComponent(email)}`,
    { headers: authHeaders(token) },
  );
  return handleResponse<UserLookupOut>(res);
}

// ---- Admin: Users ---------------------------------------------------------

export interface UserOut {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  created_at: string;
}

export async function listAdminUsers(
  token: string,
  skip = 0,
  limit = 50,
): Promise<UserOut[]> {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  const res = await fetch(`${BASE}/admin/users?${params}`, {
    headers: authHeaders(token),
  });
  return handleResponse<UserOut[]>(res);
}

export async function deleteAdminUser(token: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
}

// ---- Admin: Audit Logs ----------------------------------------------------

export interface AuditLogOut {
  id: string;
  user_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  detail: string | null;
  created_at: string;
}

export async function listAuditLogs(
  token: string,
  skip = 0,
  limit = 20,
  action?: string,
): Promise<AuditLogOut[]> {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
  });
  if (action) params.set("action", action);
  const res = await fetch(`${BASE}/admin/audit-logs?${params}`, {
    headers: authHeaders(token),
  });
  return handleResponse<AuditLogOut[]>(res);
}

// ---- Admin: Dashboard Stats -----------------------------------------------

export interface AdminStats {
  total_users: number;
  total_projects: number;
  total_files: number;
  total_audit_events: number;
}

export async function getAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${BASE}/admin/stats`, { headers: authHeaders(token) });
  return handleResponse<AdminStats>(res);
}

// ---- Admin: Role Update ---------------------------------------------------

export async function updateUserRole(
  token: string,
  userId: string,
  role: "viewer" | "editor" | "admin",
): Promise<UserOut> {
  const res = await fetch(`${BASE}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return handleResponse<UserOut>(res);
}

// ---- Admin: Password Reset ------------------------------------------------

export async function resetAdminUserPassword(
  token: string,
  userId: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${BASE}/admin/users/${userId}/reset-password`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ new_password: newPassword }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
}

// ---- Admin: Create User ---------------------------------------------------

export interface UserCreateRequest {
  email: string;
  password: string;
  role: "viewer" | "editor" | "admin";
}

export async function createAdminUser(
  token: string,
  data: UserCreateRequest,
): Promise<UserOut> {
  const res = await fetch(`${BASE}/admin/users`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<UserOut>(res);
}

// ---- Project export -------------------------------------------------------

export async function exportProjectZip(
  token: string,
  projectId: string,
  projectName: string,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/export`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Project stats --------------------------------------------------------

export interface ProjectStats {
  file_count: number;
  alignment_count: number;
  vertical_count: number;
  member_count: number;
}

export async function getProjectStats(
  token: string,
  projectId: string,
): Promise<ProjectStats> {
  const res = await fetch(`${BASE}/projects/${projectId}/stats`, {
    headers: authHeaders(token),
  });
  return handleResponse<ProjectStats>(res);
}

// ---- JWT utils (client-side payload decode, no signature check) -----------

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
}

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)) as JwtPayload;
  } catch {
    return null;
  }
}
