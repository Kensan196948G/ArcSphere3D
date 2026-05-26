import { create } from "zustand";
import type { TagOut } from "@/lib/api";
import { addProjectTag, createTag, deleteTag, listTags, removeProjectTag } from "@/lib/api";
import { notifyError, notifySuccess } from "@/state/notificationStore";

interface TagState {
  tags: TagOut[];
  loading: boolean;
  error: string | null;
  fetchTags: (token: string) => Promise<void>;
  createTag: (token: string, name: string, color?: string) => Promise<TagOut | null>;
  deleteTag: (token: string, tagId: string) => Promise<void>;
  addToProject: (token: string, projectId: string, tagId: string) => Promise<void>;
  removeFromProject: (token: string, projectId: string, tagId: string) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loading: false,
  error: null,

  fetchTags: async (token) => {
    set({ loading: true, error: null });
    try {
      const tags = await listTags(token);
      set({ tags, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createTag: async (token, name, color) => {
    try {
      const tag = await createTag(token, { name, color });
      set((s) => ({ tags: [...s.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }));
      notifySuccess(`タグ「${name}」を作成しました`);
      return tag;
    } catch (e) {
      notifyError(String(e));
      return null;
    }
  },

  deleteTag: async (token, tagId) => {
    try {
      await deleteTag(token, tagId);
      set((s) => ({ tags: s.tags.filter((t) => t.id !== tagId) }));
      notifySuccess("タグを削除しました");
    } catch (e) {
      notifyError(String(e));
    }
  },

  addToProject: async (token, projectId, tagId) => {
    try {
      await addProjectTag(token, projectId, tagId);
      const tag = get().tags.find((t) => t.id === tagId);
      notifySuccess(`タグ「${tag?.name ?? ""}」をプロジェクトに追加しました`);
    } catch (e) {
      notifyError(String(e));
    }
  },

  removeFromProject: async (token, projectId, tagId) => {
    try {
      await removeProjectTag(token, projectId, tagId);
    } catch (e) {
      notifyError(String(e));
    }
  },
}));
