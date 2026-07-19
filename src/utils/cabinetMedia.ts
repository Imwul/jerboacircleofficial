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
) {
  const response = await fetch('/api/media', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(syncKey ? { 'x-jerboa-sync-key': syncKey } : {}),
      ...(authSession ? { 'x-jerboa-session': authSession } : {}),
    },
    body: JSON.stringify({ dataUrl, fileName }),
  });
  const payload = await response.json() as CabinetMediaResponse;
  if (!response.ok || !payload.ok || !payload.url) throw new Error(payload.error || 'media_upload_failed');
  return payload.url;
}
