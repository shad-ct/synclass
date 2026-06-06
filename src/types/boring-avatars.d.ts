declare module 'boring-avatars' {
  import * as React from 'react';

  type Variant = 'marble' | 'beam' | 'pixel' | 'sunset' | 'ring' | 'bauhaus';

  interface AvatarProps {
    size?: number | string;
    name?: string;
    variant?: Variant;
    colors?: string[];
    square?: boolean;
  }

  const Avatar: React.FC<AvatarProps>;
  export default Avatar;
}
