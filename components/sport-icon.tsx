type SportIconProps = {
  src: string;
  size?: number;
  label?: string;
};

export function SportIcon({ src, size = 24, label = "" }: SportIconProps) {
  return (
    <img
      className="sport-glyph"
      src={src}
      alt={label}
      style={{ height: size }}
    />
  );
}
