interface CabinetMediaResponse {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function uploadCabinetImage(
  dataUrl: string,
  fileName: string,
  syncKey?: string,
  authSession?: string | null,
  scope: 'cabinet' | 'archive' = 'cabinet',
) {
  const response = await fetch('/api/media', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(syncKey ? { 'x-jerboa-sync-key': syncKey } : {}),
      ...(authSession ? { 'x-jerboa-session': authSession } : {}),
    },
    body: JSON.stringify({ dataUrl, fileName, scope }),
  });
  const responseText = await response.text();
  let payload: CabinetMediaResponse;
  try {
    payload = JSON.parse(responseText) as CabinetMediaResponse;
  } catch {
    throw new Error(response.status === 413 ? 'image_too_large' : `media_http_${response.status}`);
  }
  if (!response.ok || !payload.ok || !payload.url) throw new Error(payload.error || 'media_upload_failed');
  return payload.url;
}

export function uploadArchiveImage(dataUrl: string, fileName: string, authSession?: string | null) {
  return uploadCabinetImage(dataUrl, fileName, '', authSession, 'archive');
}

function mediaPathname(url: string) {
  try {
    return new URL(url, window.location.origin).searchParams.get('pathname');
  } catch {
    return null;
  }
}

export async function discardUploadedMedia(
  url: string,
  syncKey?: string,
  authSession?: string | null,
) {
  const pathname = mediaPathname(url);
  if (!pathname) return false;
  const response = await fetch('/api/media', {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      ...(syncKey ? { 'x-jerboa-sync-key': syncKey } : {}),
      ...(authSession ? { 'x-jerboa-session': authSession } : {}),
    },
    body: JSON.stringify({ pathname }),
  });
  if (response.status === 409) return false;
  if (!response.ok) throw new Error(`media_cleanup_${response.status}`);
  return true;
}
