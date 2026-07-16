import { getArchiveMediaAsset } from './mediaAssets';

function requiredMediaAsset(id: string) {
  const asset = getArchiveMediaAsset(id);
  if (!asset) throw new Error(`Missing archive media asset: ${id}`);
  return asset;
}

export const memberScribePlate = requiredMediaAsset('wellcome-hermetic-androgyne');
export const privateArchivePlate = requiredMediaAsset('wellcome-crowned-woman-alchemy').src;

export const editorialPlates = {
  masthead: requiredMediaAsset('wellcome-ripley-scroll-tree'),
  featured: requiredMediaAsset('wellcome-golden-prince'),
  archive: requiredMediaAsset('wellcome-crowned-woman-alchemy'),
  manifesto: requiredMediaAsset('wellcome-hermetic-androgyne'),
  join: requiredMediaAsset('wellcome-dragons-flowering-tree'),
  detail: requiredMediaAsset('wellcome-three-headed-eagle'),
  privateRoom: requiredMediaAsset('wellcome-ripley-scroll-tree'),
};
