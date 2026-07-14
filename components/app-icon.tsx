interface AppIconProps {
  size: number;
}

export function AppIcon({ size }: AppIconProps) {
  const scale = size / 512;

  return (
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at 72% 22%, rgba(255, 255, 255, 0.26), transparent 30%), linear-gradient(145deg, #42b98b 0%, #177b5f 68%, #106249 100%)",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "rgba(232, 250, 240, 0.2)",
          borderRadius: 999,
          height: 310 * scale,
          left: -112 * scale,
          position: "absolute",
          top: -105 * scale,
          width: 310 * scale,
        }}
      />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          height: 308 * scale,
          justifyContent: "flex-end",
          position: "relative",
          width: 280 * scale,
        }}
      >
        <div
          style={{
            border: `${25 * scale}px solid #ffffff`,
            borderBottom: "0px",
            borderRadius: `${90 * scale}px ${90 * scale}px 0 0`,
            height: 121 * scale,
            position: "absolute",
            top: 0,
            width: 144 * scale,
          }}
        />
        <div
          style={{
            alignItems: "center",
            background: "#ffffff",
            borderRadius: `${30 * scale}px ${30 * scale}px ${42 * scale}px ${42 * scale}px`,
            display: "flex",
            height: 202 * scale,
            justifyContent: "center",
            width: 280 * scale,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#e2f5e9",
              borderRadius: 999,
              display: "flex",
              height: 132 * scale,
              justifyContent: "center",
              width: 132 * scale,
            }}
          >
            <svg
              fill="none"
              height={83 * scale}
              viewBox="0 0 96 96"
              width={83 * scale}
            >
              <path
                d="M22 49.5 39.5 67 75 30"
                stroke="#177b5f"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="15"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
