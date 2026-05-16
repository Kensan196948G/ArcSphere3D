import { create } from "zustand";
import {
  createProject as apiCreateProject,
  deleteFile as apiDeleteFile,
  getDownloadUrl,
  listFiles,
  listProjects,
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
  createProject: (token: string, name: string) => Promise<void>;
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

  createProject: async (token, name) => {
    set({ loading: true, error: null });
    try {
      const project = await apiCreateProject(token, name);
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
