import { getArchiveMediaAsset } from './mediaAssets';

function requiredMediaAsset(id: string) {
  const asset = getArchiveMediaAsset(id);
  if (!asset) throw new Error(`Missing archive media asset: ${id}`);
  return asset;
}

export const memberScribePlate = requiredMediaAsset('met-473633-st-luke');
export const privateArchivePlate = requiredMediaAsset('met-466086-annunciation').src;

export const editorialPlates = {
  masthead: requiredMediaAsset('met-466191-beatus-star'),
  featured: requiredMediaAsset('met-466370-last-supper'),
  archive: requiredMediaAsset('met-662941-armenian-bifolium'),
  manifesto: requiredMediaAsset('met-466086-annunciation'),
  join: requiredMediaAsset('met-446297-fixed-stars'),
  detail: requiredMediaAsset('met-463605-singing-monks'),
  privateRoom: requiredMediaAsset('met-466086-annunciation'),
};
