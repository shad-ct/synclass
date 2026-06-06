/// <reference types="vite/client" />

// lucide-react ships types in its ESM dist which may not resolve correctly on Windows
// due to npm tar extraction issues. This declaration ensures TypeScript is happy.
declare module 'lucide-react' {
  import * as React from 'react';
  export interface LucideProps extends React.SVGAttributes<SVGElement> {
    color?: string;
    size?: string | number;
    strokeWidth?: string | number;
    absoluteStrokeWidth?: boolean;
  }
  export type LucideIcon = React.ForwardRefExoticComponent<
    LucideProps & React.RefAttributes<SVGSVGElement>
  >;
  // Named icon exports
  export const Activity: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const Bell: LucideIcon;
  export const BellRing: LucideIcon;
  export const BookOpen: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const Circle: LucideIcon;
  export const Clock: LucideIcon;
  export const Cloud: LucideIcon;
  export const Code2: LucideIcon;
  export const Copy: LucideIcon;
  export const Download: LucideIcon;
  export const FileCode: LucideIcon;
  export const FileText: LucideIcon;
  export const Hand: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const Image: LucideIcon;
  export const Lightbulb: LucideIcon;
  export const Loader2: LucideIcon;
  export const LogOut: LucideIcon;
  export const Medal: LucideIcon;
  export const Plus: LucideIcon;
  export const PlayCircle: LucideIcon;
  export const QrCode: LucideIcon;
  export const Radio: LucideIcon;
  export const Send: LucideIcon;
  export const Shuffle: LucideIcon;
  export const Snowflake: LucideIcon;
  export const Trash2: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Trophy: LucideIcon;
  export const Upload: LucideIcon;
  export const Users: LucideIcon;
  export const Wifi: LucideIcon;
  export const WifiOff: LucideIcon;
  export const X: LucideIcon;
  export const Zap: LucideIcon;
}
