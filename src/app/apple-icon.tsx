import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const TILE = "#171717";
const BAR = "#a3a3a3";
const SPIKE = "#f07162";

const BARS: readonly { height: number; color: string }[] = [
  { height: 42, color: BAR },
  { height: 62, color: BAR },
  { height: 102, color: SPIKE },
  { height: 52, color: BAR },
];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: TILE,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: 102,
          }}
        >
          {BARS.map((bar, index) => (
            <div
              key={bar.color + bar.height}
              style={{
                width: 18,
                height: bar.height,
                marginRight: index === BARS.length - 1 ? 0 : 10,
                backgroundColor: bar.color,
                borderRadius: 4,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
