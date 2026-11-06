type SportIconProps = {
  src: string;
  size?: number;
  label?: string;
};

/**
 * Sport glyphs are static SVGs under /public/icons.
 * Set both width and height so flex + `img { max-width:100% }` cannot collapse
 * tall/wide SVGs (several assets use non-square viewBoxes + preserveAspectRatio=none).
 */
export function SportIcon({ src, size = 24, label = "" }: SportIconProps) {
  return (
    <img
      className="sport-glyph"
      src={src}
      alt={label}
      width={size}
      height={size}
      decoding="async"
      style={{ width: size, height: size }}
    />
  );
}
