import type { HTMLAttributes, PropsWithChildren } from 'react';

type SurfaceProps = PropsWithChildren<HTMLAttributes<HTMLElement>>;

export function Surface({ children, className, ...props }: SurfaceProps) {
  return (
    <section
      className={[
        'rounded-[28px] border border-white/12 bg-slate-950/70 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </section>
  );
}
