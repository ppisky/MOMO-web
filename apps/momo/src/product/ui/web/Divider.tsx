// Adapted from MOMO-web, GPL-3.0. See third-party/momo-web/README.md.
import React, { useMemo } from 'react';
import { useMediaQuery } from '@mantine/hooks';

export function Divider({ orientation = 'horizontal', className = '' }: { orientation?: 'horizontal' | 'vertical'; className?: string }) {
  const isSmallScreen = useMediaQuery('(max-width: 639.95px)');
  const scale = useMemo(() => {
    if (!isSmallScreen || typeof window === 'undefined') return 1;
    return (window.devicePixelRatio || 1) > 1.5 ? 0.5 : 1;
  }, [isSmallScreen]);
  return <div className={`web-divider ${className}`} style={orientation === 'vertical'
    ? { width: '1px', transform: `scaleX(${scale})`, transformOrigin: 'center' }
    : { height: '1px', transform: `scaleY(${scale})`, transformOrigin: 'center' }} aria-hidden="true" />;
}
