// Simple Arabic calligraphy logo for Aitbaar -- transparent background.
// Rendered as inline SVG (not an <img>) so the Arabic web font loads correctly.

export default function Logo({ size = 40, color = "#1E3A5F" }) {
  return (
    <svg width={size} height={size * 0.65} viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
      <text
        x="110"
        y="60"
        textAnchor="middle"
        style={{ fontFamily: "'Aref Ruqaa', serif", fontWeight: 700 }}
        fontSize="50"
        fill={color}
      >
        اعتبار
      </text>
    </svg>
  );
}