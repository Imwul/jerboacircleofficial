export interface SuggestedReferenceMetadata {
  sourceUrl: string;
  title?: string;
  description?: string;
  creator?: string;
  date?: string;
  attribution?: string;
}

export async function suggestReferenceMetadata(sourceUrl: string, authSession: string) {
  const response = await fetch(`/api/metadata?url=${encodeURIComponent(sourceUrl)}`, {
    headers: { 'x-jerboa-session': authSession },
  });
  const payload = await response.json() as SuggestedReferenceMetadata & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `metadata_${response.status}`);
  return payload;
}
