import { FONT, MONO, C } from "../../services/config";

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{ padding: "24px 32px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, fontFamily: FONT, letterSpacing: "-0.01em" }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 11, color: C.textDim, margin: "4px 0 0", fontFamily: MONO, letterSpacing: "0.04em" }}>{subtitle}</p>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>}
    </div>
  );
}
