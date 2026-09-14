export function extractDriveId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // lh3.googleusercontent.com/d/ID or /d/ID=w1000
    if (u.hostname === "lh3.googleusercontent.com") {
      const m = u.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) return m[1];
    }
    // drive.google.com, drive.usercontent.google.com, docs.google.com
    if (u.hostname.includes("drive.google.com") || u.hostname.includes("googleusercontent.com") || u.hostname.includes("docs.google.com")) {
      const m1 = u.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m1) return m1[1];
      const id = u.searchParams.get("id");
      if (id) return id;
      // /folders/ID not image, ignore
    }
    // fallback: raw id param in query string without URL parsing (edge)
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return m2[1];
    return null;
  } catch {
    // url may not be parseable, try regex
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return m2[1];
    return null;
  }
}

export function driveCandidates(url: string): string[] {
  if (!url) return [];
  const id = extractDriveId(url);
  if (!id) {
    // not a drive url, return as-is (caller will handle)
    // but still check if it's already a direct image - return single
    if (url.startsWith("/media/")) return [url];
    // keep original
    return [url];
  }
  // Urutan fallback dari yang paling stabil ke legacy:
  // 1. lh3 (paling stabil, dipakai Google Photos/Drive CDN, no interstitial)
  // 2. lh3 dengan param resize
  // 3. drive thumbnail (kadang butuh cookie, tapi jadi fallback)
  // 4. drive uc export=view (legacy, kadang kena halaman virus scan)
  // 5. drive.usercontent download (new domain 2024)
  return [
    `https://lh3.googleusercontent.com/d/${id}`,
    `https://lh3.googleusercontent.com/d/${id}=w1000`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://drive.usercontent.google.com/download?id=${id}&export=view`,
  ];
}

export function normalizeDriveUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("drive.google.com") && !u.hostname.includes("googleusercontent.com") && !u.hostname.includes("docs.google.com")) {
      // absolute non-drive or relative /media/ keep as-is
      if (url.startsWith("/media/")) return url;
      // non-drive http(s) keep
      return url;
    }
  } catch {
    if (url.startsWith("/media/")) return url;
    if (!url.includes("drive.google") && !url.includes("googleusercontent")) return url;
  }
  const c = driveCandidates(url);
  return c[0] ?? url;
}

export function normalizeMediaUrl(url: string): string {
  if (url.startsWith("/media/")) return url;
  return normalizeDriveUrl(url);
}
