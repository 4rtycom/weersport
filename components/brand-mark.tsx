type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 42 }: BrandMarkProps) {
  return (
    <img
      className="brand-mark"
      src="/brand/symbol.svg"
      width={size}
      height={size}
      alt=""
    />
  );
}
