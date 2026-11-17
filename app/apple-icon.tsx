import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícono para "Agregar a pantalla de inicio" en iPhone (iOS no admite transparencia). */
export default async function AppleIcon() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2c2620",
        }}
      >
        <img src={`data:image/png;base64,${logo.toString("base64")}`} width={124} height={124} alt="" />
      </div>
    ),
    size
  );
}
