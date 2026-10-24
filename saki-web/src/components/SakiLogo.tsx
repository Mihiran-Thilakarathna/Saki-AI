interface Props {
  size?: number;
  /** Glow while Saki is speaking. */
  animated?: boolean;
}

/** Saki's robot app icon. */
export function SakiLogo({ size = 32, animated = false }: Props) {
  return (
    <img
      src="/saki-logo.webp"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`shrink-0 select-none rounded-[22%] ${animated ? 'saki-logo-speaking' : ''}`}
      style={{ width: size, height: size }}
    />
  );
}
