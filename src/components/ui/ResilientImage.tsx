import { useEffect, useState, type ImgHTMLAttributes } from 'react';

interface ResilientImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackLabel?: string;
}

export default function ResilientImage({
  alt = '',
  className,
  fallbackLabel = '이미지를 불러오지 못했습니다.',
  onError,
  sizes,
  src,
  srcSet,
  ...props
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);
  const responsiveSrcSet = srcSet || (
    sizes && typeof src === 'string' && src.includes('/api/media?')
      ? [320, 480, 640, 800, 1080]
        .map((width) => `${src}&width=${width}&format=webp ${width}w`)
        .join(', ')
      : undefined
  );

  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <span
        className={`resilient-image-fallback${className ? ` ${className}` : ''}`}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        lang="ko"
      >
        {alt ? fallbackLabel : ''}
      </span>
    );
  }

  return (
    <img
      {...props}
      alt={alt}
      className={className}
      sizes={sizes}
      src={src}
      srcSet={responsiveSrcSet}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
