export function youtubeId(url: string): string | null {
  const patterns = [/youtu\.be\/([\w-]{6,})/i, /youtube\.com\/watch\?v=([\w-]{6,})/i, /youtube\.com\/embed\/([\w-]{6,})/i, /youtube\.com\/shorts\/([\w-]{6,})/i];
  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match) return match[1];
  }
  return null;
}

export function instagramEmbed(url: string): string | null {
  const match = /instagram\.com\/(p|reel|tv)\/([\w-]+)/i.exec(url);
  return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed` : null;
}

export function videoThumbUrl(item: { thumb?: string | null; image: string }): string | null {
  if (item.thumb) return item.thumb;
  const id = youtubeId(item.image);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
