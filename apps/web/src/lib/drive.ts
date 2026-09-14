export function extractDriveId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // lh3.googleusercontent.com/d/FILE_ID or /d/FILE_ID=w1000
    if (u.hostname.includes("lh3.googleusercontent.com")) {
      const m = u.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) return m[1];
    }
    // drive.google.com/file/d/FILE_ID/view
    let id: string | null = null;
    const m1 = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) id = m1[1];
    // drive.google.com/thumbnail?id=FILE_ID
    if (!id) id = u.searchParams.get("id");
    // docs.google.com/uc?id=FILE_ID
    if (!id && u.hostname.includes("docs.google.com")) id = u.searchParams.get("id");
    // drive.usercontent.google.com/download?id=FILE_ID
    if (!id && u.hostname.includes("drive.usercontent.google.com")) id = u.searchParams.get("id");
    return id;
  } catch {
    return null;
  }
}

export function driveCandidates(url: string): string[] {
  const id = extractDriveId(url);
  if (!id) return [url];
  const base = `https://lh3.googleusercontent.com/d/${id}`;
  return [
    base,
    `${base}=w1000`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://drive.usercontent.google.com/download?id=${id}&export=view`,
  ];
}

export function normalizeDriveUrl(url: string): string {
  const candidates = driveCandidates(url);
  return candidates[0];
}

export function normalizeMediaUrl(url: string): string {
  if (url.startsWith("/media/")) return url;
  return normalizeDriveUrl(url);
}
