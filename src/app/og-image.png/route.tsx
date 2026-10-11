import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export async function GET() {
  const picture = `data:image/webp;base64,${(await readFile(join(process.cwd(), "public/menu-preview-pastels.webp"))).toString("base64")}`;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f9fafb", padding: 60, color: "#111827", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", width: 565 }}>
        <div style={{ fontSize: 30, color: "#0f5132", marginBottom: 32 }}>MenuCraft</div>
        <div style={{ fontSize: 52, lineHeight: 1.15 }}>La carte papier &amp; le menu digital de votre restaurant.</div>
        <div style={{ fontSize: 23, color: "#6b7280", marginTop: 30 }}>Une identité. Deux supports.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 245, height: 390, background: "white", padding: 22, border: "1px solid #dedbd4", borderRadius: 4, boxShadow: "0 20px 30px rgba(0,0,0,0.15)", transform: "rotate(-5deg)" }}>
          <div style={{ fontSize: 23, marginBottom: 12 }}>LA PLAYA</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture} width={200} height={125} alt="Carte papier et cuisine" style={{ objectFit: "cover", borderRadius: 5 }} />
          <div style={{ fontSize: 15, marginTop: 20 }}>LA CARTE</div>
          <div style={{ fontSize: 13, marginTop: 14, color: "#6b7280" }}>Entrées · Plats · Desserts</div>
          <div style={{ fontSize: 13, marginTop: 20 }}>Pastels à la viande</div>
          <div style={{ fontSize: 13, marginTop: 12 }}>Salade de mangue</div>
          <div style={{ fontSize: 13, marginTop: 12 }}>Nems au Poulet Yassa</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 175, height: 380, padding: 10, borderRadius: 29, background: "#111827", transform: "rotate(5deg)" }}>
          <div style={{ display: "flex", height: "100%", flexDirection: "column", background: "white", borderRadius: 22, overflow: "hidden" }}>
            <div style={{ height: 18, width: 62, borderRadius: 14, background: "#111827", alignSelf: "center" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picture} width={155} height={100} alt="Menu sur smartphone" style={{ objectFit: "cover" }} />
            <div style={{ padding: 12, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 19 }}>la playa</div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 10 }}>Entrées · Plats · Desserts</div>
              {["Pastel à la viande", "Salade de Mangue", "Nems au Poulet"].map(name => <div key={name} style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 11 }}><div>{name}</div><div style={{ color: "#2563eb", marginTop: 5 }}>2 000 FCFA</div></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>, { width: 1200, height: 630 },
  );
}
