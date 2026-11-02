export default function Logo({ size = 28 }) {
  return (
    <span
      className="bg-arna inline-grid place-items-center rounded-full text-[#070a1c] font-black select-none"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      A
    </span>
  );
}
