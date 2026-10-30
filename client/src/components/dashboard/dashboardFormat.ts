export function greet(firstName: string | null | undefined): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${greeting}, ${firstName?.trim() || "there"}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

/** Button/link styles for actions placed inside the dashboard hero. */
export const heroPrimaryAction =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#6D5EF5] text-sm font-bold shadow-sm hover:bg-[#f6f2ff] transition-colors no-underline cursor-pointer disabled:opacity-60";
export const heroSecondaryAction =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/30 text-white text-sm font-semibold hover:bg-white/25 transition-colors no-underline cursor-pointer disabled:opacity-60";
