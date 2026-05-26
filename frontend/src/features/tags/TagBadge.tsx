import type { TagOut } from "@/lib/api";

interface TagBadgeProps {
  tag: TagOut;
  onRemove?: () => void;
  size?: "sm" | "md";
}

export default function TagBadge({ tag, onRemove, size = "sm" }: TagBadgeProps) {
  const padding = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${padding}`}
      style={{ backgroundColor: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}44` }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 leading-none"
          aria-label={`タグ「${tag.name}」を削除`}
        >
          ×
        </button>
      )}
    </span>
  );
}
