import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** App icon used by Next metadata and as a PWA fallback. */
export default function Icon() {
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
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: "-0.06em",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        HC
      </div>
    ),
    size,
  );
}
