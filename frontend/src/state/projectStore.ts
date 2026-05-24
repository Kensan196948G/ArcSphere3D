import { create } from "zustand";
import {
  createProject as apiCreateProject,
  deleteFile as apiDeleteFile,
  deleteProject as apiDeleteProject,
  getDownloadUrl,
  listFiles,
  listProjects,
  updateProject as apiUpdateProject,
  uploadFile as apiUploadFile,
  type FileMetadata,
  type ProjectOut,
} from "@/lib/api";

interface ProjectState {
  projects: ProjectOut[];
  selectedProjectId: string | null;
  files: FileMetadata[];
  loading: boolean;
  error: string | null;

  fetchProjects: (token: string) => Promise<void>;
  selectProject: (token: string, projectId: string) => Promise<void>;
  createProject: (token: string, name: string, description?: string) => Promise<void>;
  renameProject: (
    token: string,
    projectId: string,
    name: string,
    description?: string | null,
  ) => Promise<void>;
  deleteProject: (token: string, projectId: string) => Promise<void>;
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
  loading: false,
  error: null,

  fetchProjects: async (token) => {
    set({ loading: true, error: null });
    try {
      const projects = await listProjects(token);
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
