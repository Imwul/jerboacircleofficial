import { useEffect, useState, type ImgHTMLAttributes } from 'react';

interface ResilientImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackLabel?: string;
}

export default function ResilientImage({
  alt = '',
  className,
  fallbackLabel = '이미지를 불러오지 못했습니다.',
  onError,
  src,
  ...props
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

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
      src={src}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
