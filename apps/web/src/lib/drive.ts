export function normalizeDriveUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("drive.google.com")) return url;
    // /file/d/FILE_ID/view
    let id: string | null = null;
    const m1 = u.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) id = m1[1];
    // ?id=FILE_ID or ?id=FILE_ID&...
    if (!id) id = u.searchParams.get("id");
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    return url;
  } catch {
    return url;
  }
}
export function normalizeMediaUrl(url: string): string {
  // keep /media/ and http(s) as-is, only transform drive
  if (url.startsWith("/media/")) return url;
  return normalizeDriveUrl(url);
}
