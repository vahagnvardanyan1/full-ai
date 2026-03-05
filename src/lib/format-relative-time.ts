/**
 * Formats an ISO date string or Date into a human-readable relative time,
 * e.g. "3m ago", "2h ago", "5d ago".
 */
export const formatRelativeTime = (date: string | Date): string => {
  const ms = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(ms / 1000);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

/**
 * Formats a duration in milliseconds into a human-readable string,
 * e.g. "3m 42s", "58s".
 */
export const formatDuration = (startIso: string, endIso: string): string => {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return "—";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};
