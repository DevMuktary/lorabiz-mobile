// Lorabiz Signature Color Palette
export const brandColors = {
  primary: "#C82D75", // Iconic Lorabiz Pink
  primaryDark: "#9D1755", // Deep luxury magenta
  primaryLight: "#E54F98", // Vibrant glow pink
  primarySoft: "rgba(200, 45, 117, 0.10)",
  accent: "#8B5CF6", // Electric purple / violet accent
};

export const lightColors = {
  ...brandColors,
  // Backgrounds - Crisp, clean, bank-grade light canvas
  background: "#FFFFFF",
  surface: "#F8FAFC",
  surfaceElevated: "#FFFFFF",
  surfaceBorder: "#E2E8F0",
  surfaceBorderLight: "rgba(200, 45, 117, 0.15)",

  // Typography
  text: "#0F172A", // Deep charcoal slate
  textSecondary: "#475569", // Medium slate
  textMuted: "#94A3B8", // Subtle gray
  textInverse: "#FFFFFF",

  // Status & Feedback
  success: "#10B981",
  successSurface: "#ECFDF5",
  warning: "#F59E0B",
  warningSurface: "#FFFBEB",
  error: "#EF4444",
  errorSurface: "#FEF2F2",
  info: "#0284C7",

  // Service Specific Accents
  gold: "#D97706",
  purple: "#7C3AED",
  cyan: "#0891B2",
  pink: "#C82D75",
};

export const darkColors = {
  ...brandColors,
  // Backgrounds - Ultra-clean dark glassmorphism
  background: "#070B14",
  surface: "#0F172A",
  surfaceElevated: "#182238",
  surfaceBorder: "#1E293B",
  surfaceBorderLight: "rgba(200, 45, 117, 0.25)",

  // Typography
  text: "#FFFFFF",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  textInverse: "#FFFFFF",

  // Status & Feedback
  success: "#10B981",
  successSurface: "#064E3B",
  warning: "#F59E0B",
  warningSurface: "#78350F",
  error: "#EF4444",
  errorSurface: "#7F1D1D",
  info: "#38BDF8",

  // Service Specific Accents
  gold: "#F59E0B",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  pink: "#C82D75",
};

// Default export uses Light Mode per user specification
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.text },
  bodyMuted: { fontSize: 14, fontWeight: "400" as const, color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: "500" as const, color: colors.textMuted },
};
