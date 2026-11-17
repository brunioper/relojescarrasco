import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Relojes Carrasco — relojes suizos nuevos y usados en Montevideo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen que se ve al compartir un link del sitio (WhatsApp, Instagram, etc.). */
export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2c2620 0%, #3d342a 100%)",
          color: "#f8f5ef",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 36,
            left: 36,
            right: 36,
            bottom: 36,
            border: "1px solid rgba(200, 164, 96, 0.55)",
            display: "flex",
          }}
        />
        <img src={logoSrc} width={150} height={150} alt="" />
        <div style={{ marginTop: 34, fontSize: 68, letterSpacing: 14, display: "flex" }}>
          RELOJES CARRASCO
        </div>
        <div style={{ marginTop: 26, width: 90, height: 2, background: "#c8a460", display: "flex" }} />
        <div style={{ marginTop: 26, fontSize: 30, color: "#dccfb6", display: "flex" }}>
          Relojes suizos nuevos y usados · Montevideo
        </div>
      </div>
    ),
    size
  );
}
