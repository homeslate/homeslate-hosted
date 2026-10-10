import type { SVGProps } from 'react';
import classes from './HomeslateMark.module.css';

type HomeslateMarkProps = SVGProps<SVGSVGElement> & {
  size?: number;
  framed?: boolean;
};

function MarkBars() {
  return (
    <>
      <rect className={classes.bar} x="2" y="2" width="6.33" height="28" rx="1.5" />
      <rect className={classes.accent} x="12.83" y="2" width="6.33" height="11.75" rx="1.5" />
      <rect className={classes.bar} x="12.83" y="18.25" width="6.33" height="11.75" rx="1.5" />
      <rect className={classes.bar} x="23.67" y="2" width="6.33" height="28" rx="1.5" />
    </>
  );
}

export function HomeslateMark({
  size = 32,
  framed = false,
  className,
  ...props
}: HomeslateMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={[classes.svg, className].filter(Boolean).join(' ')}
      {...props}
    >
      {framed ? (
        <>
          <rect className={classes.frame} width="32" height="32" rx="6" />
          <g transform="translate(3.2 3.2) scale(0.8)">
            <MarkBars />
          </g>
        </>
      ) : (
        <MarkBars />
      )}
    </svg>
  );
}
