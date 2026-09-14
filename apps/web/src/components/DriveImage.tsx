import { useEffect, useMemo, useState } from "react";
import { driveCandidates } from "../lib/drive";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | undefined | null;
  fallbackClassName?: string;
};

export function DriveImage({ src, alt = "", className, fallbackClassName, referrerPolicy = "no-referrer", loading = "lazy", decoding = "async", crossOrigin, onError, ...rest }: Props) {
  const candidates = useMemo(() => (src ? driveCandidates(src) : []), [src]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [src]);

  if (!src) return null;

  const showFallback = failed;

  if (showFallback) {
    // Placeholder elegan — tetap pakai className agar ukuran layout terjaga
    return (
      <div
        className={`grid place-items-center bg-midnight/[0.06] text-midnight/45 ${className ?? ""} ${fallbackClassName ?? ""}`}
        role="img"
        aria-label={alt || "Gambar tidak tersedia"}
        title={alt || "Gambar tidak tersedia"}
      >
        <span className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm">🖼️</span>
          <span className="text-[11px] font-bold leading-tight text-midnight/50">Gambar tidak tersedia</span>
          {src && <span className="max-w-[14ch] truncate text-[10px] text-midnight/30">{src.slice(0, 40)}</span>}
        </span>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        referrerPolicy={referrerPolicy}
        loading={loading}
        decoding={decoding}
        crossOrigin={crossOrigin}
        onError={() => setFailed(true)}
        {...rest}
      />
    );
  }

  const current = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      referrerPolicy={referrerPolicy}
      crossOrigin={crossOrigin}
      loading={loading}
      decoding={decoding}
      onError={(e) => {
        if (idx + 1 < candidates.length) {
          setIdx(idx + 1);
        } else {
          setFailed(true);
          onError?.(e as any);
        }
      }}
      {...rest}
    />
  );
}

// Untuk kasus logo yang perlu deteksi gagal total (fallback ke Crest)
export function useDriveFallback(src: string | undefined | null) {
  const candidates = useMemo(() => (src ? driveCandidates(src) : []), [src]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [src]);
  const current = candidates[Math.min(idx, candidates.length - 1)] ?? src ?? "";
  const next = () => setIdx((i) => (i + 1 < candidates.length ? i + 1 : i));
  const hasMore = idx + 1 < candidates.length;
  return { src: current, next, hasMore, candidates };
}
