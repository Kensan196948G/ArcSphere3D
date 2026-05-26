import { create } from "zustand";
import {
  archiveProject as apiArchiveProject,
  createProject as apiCreateProject,
  deleteFile as apiDeleteFile,
  deleteProject as apiDeleteProject,
  getDownloadUrl,
  getProjectActivity as apiGetProjectActivity,
  listFiles,
  listProjects,
  unarchiveProject as apiUnarchiveProject,
  updateProject as apiUpdateProject,
  uploadFile as apiUploadFile,
  type AuditLogOut,
  type FileMetadata,
  type ProjectOut,
} from "@/lib/api";

interface ProjectState {
  projects: ProjectOut[];
  selectedProjectId: string | null;
  files: FileMetadata[];
  activity: AuditLogOut[];
  loading: boolean;
  error: string | null;
  showArchived: boolean;
  tagFilter: string | null;

  fetchProjects: (token: string, q?: string, tag?: string) => Promise<void>;
  setTagFilter: (token: string, tag: string | null) => Promise<void>;
  selectProject: (token: string, projectId: string) => Promise<void>;
  fetchFiles: (token: string, search?: string, ext?: string) => Promise<void>;
  fetchActivity: (token: string) => Promise<void>;
  createProject: (token: string, name: string, description?: string) => Promise<void>;
  renameProject: (
    token: string,
    projectId: string,
    name: string,
    description?: string | null,
  ) => Promise<void>;
  deleteProject: (token: string, projectId: string) => Promise<void>;
  archiveProject: (token: string, projectId: string) => Promise<void>;
  unarchiveProject: (token: string, projectId: string) => Promise<void>;
  toggleShowArchived: (token: string) => Promise<void>;
  uploadFile: (token: string, file: File) => Promise<FileMetadata | null>;
  deleteFile: (token: string, fileId: string) => Promise<void>;
  getDownloadUrl: (
    token: string,
    fileId: string,
  ) => Promise<{ url: string; expires_in: number } | null>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  files: [],
  activity: [],
  loading: false,
  error: null,
  showArchived: false,
  tagFilter: null,

  fetchProjects: async (token, q, tag) => {
    set({ loading: true, error: null });
    try {
      const { showArchived } = get();
      const projects = await listProjects(token, 0, 50, q, showArchived, tag);
      set({ projects, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  setTagFilter: async (token, tag) => {
    set({ tagFilter: tag });
    const { showArchived } = get();
    set({ loading: true, error: null });
    try {
      const projects = await listProjects(token, 0, 50, undefined, showArchived, tag ?? undefined);
      set({ projects, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  selectProject: async (token, projectId) => {
    set({ selectedProjectId: projectId, loading: true, error: null });
    try {
      const files = await listFiles(token, projectId);
      set({ files, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  fetchFiles: async (token, search, ext) => {
    const { selectedProjectId } = get();
    if (!selectedProjectId) return;
    set({ loading: true, error: null });
    try {
      const files = await listFiles(token, selectedProjectId, 0, 50, search, ext);
      set({ files, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  fetchActivity: async (token) => {
    const { selectedProjectId } = get();
    if (!selectedProjectId) return;
    set({ loading: true, error: null });
    try {
      const activity = await apiGetProjectActivity(token, selectedProjectId);
      set({ activity, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  createProject: async (token, name, description) => {
    set({ loading: true, error: null });
    try {
      const project = await apiCreateProject(token, name, description);
      set((s) => ({
        projects: [...s.projects, project],
        selectedProjectId: project.id,
        files: [],
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  renameProject: async (token, projectId, name, description) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiUpdateProject(token, projectId, name, description);
      set((s) => ({
        projects: s.projects.map((p) => (p.id === projectId ? updated : p)),
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  deleteProject: async (token, projectId) => {
    set({ loading: true, error: null });
    try {
      await apiDeleteProject(token, projectId);
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== projectId),
        selectedProjectId:
          s.selectedProjectId === projectId ? null : s.selectedProjectId,
        files: s.selectedProjectId === projectId ? [] : s.files,
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  archiveProject: async (token, projectId) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiArchiveProject(token, projectId);
      const { showArchived } = get();
      set((s) => ({
        projects: showArchived
          ? s.projects.map((p) => (p.id === projectId ? updated : p))
          : s.projects.filter((p) => p.id !== projectId),
        selectedProjectId:
          !showArchived && s.selectedProjectId === projectId
            ? null
            : s.selectedProjectId,
        files:
          !showArchived && s.selectedProjectId === projectId ? [] : s.files,
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  unarchiveProject: async (token, projectId) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiUnarchiveProject(token, projectId);
      set((s) => ({
        projects: s.projects.map((p) => (p.id === projectId ? updated : p)),
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  toggleShowArchived: async (token) => {
    const { showArchived } = get();
    set({ showArchived: !showArchived });
    const { fetchProjects } = get();
    await fetchProjects(token);
  },

  uploadFile: async (token, file) => {
    const { selectedProjectId } = get();
    if (!selectedProjectId) return null;
    set({ loading: true, error: null });
    try {
      const meta = await apiUploadFile(token, selectedProjectId, file);
      set((s) => ({
        files: [...s.files.filter((f) => f.id !== meta.id), meta],
        loading: false,
      }));
      return meta;
    } catch (e) {
      set({ loading: false, error: String(e) });
      return null;
    }
  },

  deleteFile: async (token, fileId) => {
    set({ loading: true, error: null });
    try {
      await apiDeleteFile(token, fileId);
      set((s) => ({
        files: s.files.filter((f) => f.id !== fileId),
        loading: false,
      }));
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  getDownloadUrl: async (token, fileId) => {
    const { selectedProjectId } = get();
    if (!selectedProjectId) return null;
    try {
      return await getDownloadUrl(token, selectedProjectId, fileId);
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },
}));
