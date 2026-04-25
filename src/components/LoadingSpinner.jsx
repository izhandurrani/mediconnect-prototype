import React from 'react';

const SIZES = { sm: 16, md: 24, lg: 36 };

export default function LoadingSpinner({ size = 'md', color = 'border-white' }) {
  const px = SIZES[size] || SIZES.md;

  return (
    <span
      className={`inline-block rounded-full border-2 border-t-transparent animate-spin ${color}`}
      style={{ width: px, height: px }}
      role="status"
      aria-label="Loading"
    />
  );
}
