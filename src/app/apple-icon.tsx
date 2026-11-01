import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontSize: 78,
          fontWeight: 700,
          letterSpacing: "-0.06em",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          borderRadius: 36,
        }}
      >
        HC
      </div>
    ),
    size,
  );
}
