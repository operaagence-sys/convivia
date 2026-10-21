// Contraintes photos uniques (TRD § 9). Source des variables {formats} et {maxSize}.
export const PHOTO_FORMATS_LABEL = 'JPEG, PNG, WebP, HEIC';
export const PHOTO_MAX_SIZE_LABEL = '10 Mo';
export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const PHOTO_TEXT_VARS = {
  formats: PHOTO_FORMATS_LABEL,
  maxSize: PHOTO_MAX_SIZE_LABEL,
} as const;
