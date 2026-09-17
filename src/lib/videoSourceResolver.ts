/**
 * Video Source Resolution Utility
 * 
 * Automatically identifies video source type and resolves appropriate playback method:
 * - Local Library & uploads (MP4 / HLS)
 * - Remote HLS streams (.m3u8)
 * - Direct browser-playable video files (.mp4, .webm, .m4v, .ogg, .ogv)
 * - YouTube (watch, shorts, youtu.be, m.youtube.com, /live, /embed)
 * - Vimeo & other supported embeddable video providers
 * - Graceful fallback for unsupported non-video web pages
 */

export type ResolvedSourceType =
  | 'youtube'
  | 'vimeo'
  | 'embed'
  | 'hls'
  | 'html5'
  | 'unsupported'
  | 'empty';

export interface ResolvedVideoSource {
  type: ResolvedSourceType;
  originalUrl: string;
  playbackUrl: string;
  providerId?: string;
  isEmbed: boolean;
  isHtml5: boolean;
  errorMessage?: string;
}

const YOUTUBE_HOSTNAMES = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

/**
 * Validates whether the URL's actual hostname is a recognized YouTube domain.
 * Prevents false positives like https://example.com/youtube.com/video.
 */
export function isYouTubeUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (YOUTUBE_HOSTNAMES.has(host)) return true;
    if (host.endsWith('.youtube.com') || host.endsWith('.youtube-nocookie.com') || host.endsWith('.youtu.be')) {
      return true;
    }
  } catch {
    // Ignore URL parse error
  }
  return false;
}

/**
 * Robustly parses YouTube Video ID from any legitimate YouTube URL variant:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID&feature=...
 * - https://youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID?si=...
 * - https://youtu.be/VIDEO_ID?si=...
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://m.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube-nocookie.com/embed/VIDEO_ID
 */
export function parseYouTubeId(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Enforce legitimate YouTube hostname before extracting video ID
  if (!isYouTubeUrl(trimmed)) return null;

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    // 1. youtu.be/VIDEO_ID
    if (host === 'youtu.be' || host === 'www.youtu.be' || host.endsWith('.youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id && /^[\w-]{11}$/.test(id)) {
        return id;
      }
    }

    // 2. /watch?v=VIDEO_ID or search params
    if (parsed.searchParams.has('v')) {
      const v = parsed.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
    }

    // 3. /shorts/VIDEO_ID, /embed/VIDEO_ID, /live/VIDEO_ID, /v/VIDEO_ID
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const firstPart = pathParts[0].toLowerCase();
      if (['shorts', 'embed', 'live', 'v'].includes(firstPart) && pathParts[1]) {
        if (/^[\w-]{11}$/.test(pathParts[1])) {
          return pathParts[1];
        }
      }
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && /^[\w-]{11}$/.test(lastPart)) {
        return lastPart;
      }
    }
  } catch {
    // Ignore URL parse error
  }

  // Regex fallback matching standard YouTube paths
  const regExp = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+?&v=|shorts\/|live\/))([\w-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

const VIMEO_HOSTNAMES = new Set([
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
]);

/**
 * Validates whether the URL's actual hostname is a recognized Vimeo domain.
 * Prevents false positives like https://example.com/vimeo.com/video.
 */
export function isVimeoUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (VIMEO_HOSTNAMES.has(host) || host.endsWith('.vimeo.com')) {
      return true;
    }
  } catch {
    // Ignore URL parse error
  }
  return false;
}

/**
 * Parses Vimeo ID from legitimate Vimeo video URLs:
 * - https://vimeo.com/123456789
 * - https://player.vimeo.com/video/123456789
 * - https://vimeo.com/channels/staffpicks/123456789
 * - https://vimeo.com/manage/videos/123456789
 */
export function parseVimeoId(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Enforce legitimate Vimeo hostname before extracting video ID
  if (!isVimeoUrl(trimmed)) return null;

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    for (const part of pathParts) {
      if (/^\d{6,12}$/.test(part)) {
        return part;
      }
    }
  } catch {
    // Ignore URL parse error
  }

  const regExp = /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|manage\/videos\/|)(\d+)|player\.vimeo\.com\/video\/(\d+))/;
  const match = trimmed.match(regExp);
  if (match && (match[1] || match[2])) {
    return match[1] || match[2];
  }

  return null;
}

/**
 * Only browser-safe direct video formats natively playable in HTML5 <video>
 */
const DIRECT_VIDEO_EXTENSIONS = [
  '.mp4', '.webm', '.m4v', '.ogg', '.ogv'
];

export function isDirectVideoUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return DIRECT_VIDEO_EXTENSIONS.some(ext => clean.endsWith(ext));
}

export function isHlsUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return clean.endsWith('.m3u8') || url.toLowerCase().includes('.m3u8');
}

/**
 * Identifies local/relative paths or blob schemes.
 * HTTPS/HTTP URLs are NEVER treated as local paths.
 */
export function isLocalMediaPath(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return !trimmed.startsWith('http://') && !trimmed.startsWith('https://');
}

/**
 * Resolves any video source / external URL into its concrete playback strategy.
 */
export function resolveVideoSource(rawUrl?: string): ResolvedVideoSource {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      type: 'empty',
      originalUrl: '',
      playbackUrl: '',
      isEmbed: false,
      isHtml5: false,
    };
  }

  const trimmed = rawUrl.trim();

  // 1. YouTube check — NEVER allow YouTube to reach HTML5 <video src>
  if (isYouTubeUrl(trimmed)) {
    const ytId = parseYouTubeId(trimmed);
    if (ytId) {
      return {
        type: 'youtube',
        originalUrl: trimmed,
        playbackUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1&rel=0`,
        providerId: ytId,
        isEmbed: true,
        isHtml5: false,
      };
    }
    // Unrecognized / non-video YouTube page (e.g. youtube.com/about)
    return {
      type: 'unsupported',
      originalUrl: trimmed,
      playbackUrl: '',
      isEmbed: false,
      isHtml5: false,
      errorMessage: 'Invalid or unrecognized YouTube video link. Please provide a valid YouTube watch or shorts URL.',
    };
  }

  // 2. Vimeo check
  if (isVimeoUrl(trimmed)) {
    const vimeoId = parseVimeoId(trimmed);
    if (vimeoId) {
      return {
        type: 'vimeo',
        originalUrl: trimmed,
        playbackUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`,
        providerId: vimeoId,
        isEmbed: true,
        isHtml5: false,
      };
    }
    return {
      type: 'unsupported',
      originalUrl: trimmed,
      playbackUrl: '',
      isEmbed: false,
      isHtml5: false,
      errorMessage: 'Invalid or unrecognized Vimeo video link.',
    };
  }

  // 3. Generic Embed URL check (only explicit /embed/ endpoints)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.includes('/embed/') || parsed.pathname.startsWith('/embed')) {
        return {
          type: 'embed',
          originalUrl: trimmed,
          playbackUrl: trimmed,
          isEmbed: true,
          isHtml5: false,
        };
      }
    } catch {
      // Ignore
    }
  }

  // 4. HLS (.m3u8) check — preserves full URL with all query parameters/tokens
  if (isHlsUrl(trimmed)) {
    return {
      type: 'hls',
      originalUrl: trimmed,
      playbackUrl: trimmed,
      isEmbed: false,
      isHtml5: true,
    };
  }

  // 5. Direct browser-playable video format (.mp4, .webm, .m4v, .ogg, .ogv)
  if (isDirectVideoUrl(trimmed)) {
    return {
      type: 'html5',
      originalUrl: trimmed,
      playbackUrl: trimmed,
      isEmbed: false,
      isHtml5: true,
    };
  }

  // 6. Local library / relative upload paths (non-http/https)
  if (isLocalMediaPath(trimmed)) {
    return {
      type: 'html5',
      originalUrl: trimmed,
      playbackUrl: trimmed,
      isEmbed: false,
      isHtml5: true,
    };
  }

  // 7. Non-video external webpage URL (e.g. https://google.com, https://example.com/watch)
  return {
    type: 'unsupported',
    originalUrl: trimmed,
    playbackUrl: '',
    isEmbed: false,
    isHtml5: false,
    errorMessage: 'This external link is a webpage and cannot be played directly. Please provide a direct video stream (.mp4, .m3u8) or a supported video link (YouTube, Vimeo).',
  };
}
