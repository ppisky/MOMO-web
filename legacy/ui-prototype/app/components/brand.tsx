export function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <img
      className={`brand-mark ${large ? "brand-mark-large" : ""}`}
      src="/brand/momo.png"
      alt=""
      draggable={false}
    />
  );
}
