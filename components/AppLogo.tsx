interface AppLogoProps {
  iconSize?: number;
  textSize?: number;
  showText?: boolean;
}

export default function AppLogo({ iconSize = 36, textSize = 18, showText = true }: AppLogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: iconSize * 0.15 }}>
      <img
        src="/icon.svg"
        alt="DayChecked"
        width={iconSize}
        height={iconSize}
        style={{ display: "block", flexShrink: 0 }}
      />
      {showText && (
        <span style={{ fontSize: textSize, lineHeight: 1, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 400, color: "var(--text)" }}>Day</span>
          <span style={{ fontWeight: 800, color: "var(--text)" }}>Checked</span>
        </span>
      )}
    </div>
  );
}
