interface Props {
  size?: number;
  /** Glow while Saki is speaking or thinking. */
  animated?: boolean;
}

/** Saki's logo: the robot in the "S" ribbon. */
export function SakiLogo({ size = 32, animated = false }: Props) {
  return (
    <img
      src="/saki-logo.webp"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`shrink-0 select-none object-contain ${animated ? 'saki-logo-speaking' : ''}`}
      style={{ width: size, height: size }}
    />
  );
}
