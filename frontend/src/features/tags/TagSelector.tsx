import { useEffect, useRef, useState } from "react";
import type { TagOut } from "@/lib/api";
import { useTagStore } from "@/state/tagStore";
import TagBadge from "./TagBadge";

interface TagSelectorProps {
  token: string;
  projectId: string;
  attachedTags: TagOut[];
  role: "owner" | "editor" | "viewer";
  onTagsChange: (tags: TagOut[]) => void;
}

export default function TagSelector({
  token,
  projectId,
  attachedTags,
  role,
  onTagsChange,
}: TagSelectorProps) {
  const fetchTags = useTagStore((s) => s.fetchTags);
  const { addToProject, removeFromProject } = useTagStore.getState();
  const allTags = useTagStore((s) => s.tags);
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canEdit = role !== "viewer";

  useEffect(() => {
    void fetchTags(token);
  }, [token, fetchTags]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAttached = (tagId: string) => attachedTags.some((t) => t.id === tagId);

  const handleToggleTag = async (tag: TagOut) => {
    if (!canEdit) return;
    if (isAttached(tag.id)) {
      await removeFromProject(token, projectId, tag.id);
      onTagsChange(attachedTags.filter((t) => t.id !== tag.id));
    } else {
      await addToProject(token, projectId, tag.id);
      onTagsChange([...attachedTags, tag]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setCreating(true);
    const { createTag } = useTagStore.getState();
    const tag = await createTag(token, newTagName.trim(), newTagColor);
    if (tag) {
      await addToProject(token, projectId, tag.id);
      onTagsChange([...attachedTags, tag]);
      setNewTagName("");
    }
    setCreating(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex flex-wrap gap-1 items-center">
        {attachedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            onRemove={canEdit ? () => void handleToggleTag(tag) : undefined}
          />
        ))}
        {canEdit && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-gray-400 hover:text-blue-400 border border-dashed border-gray-600 rounded px-1.5 py-0.5"
          >
            + タグ
          </button>
        )}
      </div>

      {open && canEdit && (
        <div className="absolute z-50 mt-1 w-56 bg-gray-800 border border-gray-700 rounded shadow-lg p-2">
          <p className="text-xs text-gray-400 mb-1">タグを選択</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {allTags.length === 0 && (
              <p className="text-xs text-gray-500 py-1">タグがありません</p>
            )}
            {allTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => void handleToggleTag(tag)}
                className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs hover:bg-gray-700 ${
                  isAttached(tag.id) ? "bg-gray-700" : ""
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span>{tag.name}</span>
                {isAttached(tag.id) && <span className="ml-auto text-blue-400">✓</span>}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-700 mt-2 pt-2">
            <p className="text-xs text-gray-400 mb-1">新規タグ作成</p>
            <div className="flex gap-1 items-center">
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateTag();
                }}
                placeholder="タグ名"
                className="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
                maxLength={64}
              />
              <button
                onClick={() => void handleCreateTag()}
                disabled={creating || !newTagName.trim()}
                className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-2 py-1"
              >
                {creating ? "…" : "作成"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
