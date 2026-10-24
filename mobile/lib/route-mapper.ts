// mobile/lib/route-mapper.ts
// Robust resolver that maps backend web links, push payloads, and notification texts
// directly to valid internal mobile Expo Router screens.

export function resolveMobileRoute(
  link?: string | null,
  title?: string,
  message?: string
): string {
  const raw = (link || "").trim().toLowerCase();
  const text = `${title || ""} ${message || ""}`.toLowerCase();

  // 1. Direct valid mobile routes match
  if (link && link.startsWith("/")) {
    const validExactRoutes = [
      "/(tabs)",
      "/(tabs)/wallet",
      "/(tabs)/services",
      "/(tabs)/bills",
      "/(tabs)/activity",
      "/(tabs)/profile",
      "/wallet/fund",
      "/wallet/disputes",
      "/notifications",
      "/profile/settings",
      "/profile/security",
      "/profile/legal",
      "/profile/personal-details",
      "/services/annual-returns",
      "/services/annual-returns-history",
      "/services/business-name",
      "/services/business-name-history",
      "/services/tax-id",
      "/services/tax-id-history",
      "/services/scuml",
      "/services/scuml-history",
      "/services/nin-validation",
      "/services/nin-validation-history",
      "/services/nin-modification",
      "/services/nin-modification-history",
      "/services/nin-personalization",
      "/services/nin-personalization-history",
      "/services/nin-ipe",
      "/services/nin-ipe-history",
      "/services/nin-slip",
      "/services/bvn-retrieval",
      "/services/bvn-retrieval-history",
      "/services/bvn-modification",
      "/services/bvn-modification-history",
      "/services/bvn-slip",
      "/services/slip-history",
    ];

    if (validExactRoutes.includes(link)) {
      return link;
    }
  }

  // 2. Annual Returns
  if (raw.includes("annual-return") || text.includes("annual return")) {
    return "/services/annual-returns-history";
  }

  // 3. Disputes / Inquiry Cases
  if (raw.includes("dispute") || text.includes("dispute")) {
    // If it has a specific transaction ID in link, e.g. /dispute/123 or /wallet/transaction/...
    const txIdMatch = link?.match(/([0-9a-fA-F-]{10,})/);
    if (txIdMatch && txIdMatch[1]) {
      return `/wallet/transaction/dispute/${txIdMatch[1]}`;
    }
    return "/wallet/disputes";
  }

  // 4. NIN Services
  if (raw.includes("nin/validation") || raw.includes("nin-validation") || text.includes("nin validation")) {
    return "/services/nin-validation-history";
  }
  if (raw.includes("nin/modification") || raw.includes("nin-modification") || text.includes("nin modification")) {
    return "/services/nin-modification-history";
  }
  if (raw.includes("nin/personalization") || raw.includes("nin-personalization") || text.includes("personalization")) {
    return "/services/nin-personalization-history";
  }
  if (raw.includes("nin/ipe") || raw.includes("nin-ipe") || text.includes("ipe")) {
    return "/services/nin-ipe-history";
  }
  if (raw.includes("nin/slip") || raw.includes("nin-slip") || text.includes("nin slip")) {
    return "/services/slip-history";
  }

  // 5. Tax ID
  if (raw.includes("tax-id") || raw.includes("taxid") || raw.includes("tin") || text.includes("tax id") || text.includes("tin")) {
    return "/services/tax-id-history";
  }

  // 6. SCUML
  if (raw.includes("scuml") || text.includes("scuml")) {
    return "/services/scuml-history";
  }

  // 7. BVN Services
  if (raw.includes("bvn/retrieval") || raw.includes("bvn-retrieval") || text.includes("bvn retrieval")) {
    return "/services/bvn-retrieval-history";
  }
  if (raw.includes("bvn/modification") || raw.includes("bvn-modification") || text.includes("bvn modification")) {
    return "/services/bvn-modification-history";
  }
  if (raw.includes("bvn/slip") || raw.includes("bvn-slip") || text.includes("bvn slip")) {
    return "/services/slip-history";
  }

  // 8. CAC Incorporation / Registration
  if (raw.includes("cac") || text.includes("incorporation") || text.includes("business name")) {
    return "/services/business-name-history";
  }

  // 9. Digital Slips
  if (raw.includes("slip") || text.includes("slip")) {
    return "/services/slip-history";
  }

  // 10. Wallet / Transactions / Deposits
  if (raw.includes("fund") || text.includes("fund wallet") || text.includes("deposit")) {
    return "/wallet/fund";
  }
  if (
    raw.includes("wallet") ||
    raw.includes("transaction") ||
    text.includes("wallet") ||
    text.includes("credited") ||
    text.includes("debited")
  ) {
    return "/(tabs)/wallet";
  }

  // 11. Profile & Settings
  if (raw.includes("security") || text.includes("security") || text.includes("password")) {
    return "/profile/security";
  }
  if (raw.includes("setting") || text.includes("setting")) {
    return "/profile/settings";
  }
  if (raw.includes("legal") || text.includes("terms") || text.includes("privacy")) {
    return "/profile/legal";
  }
  if (raw.includes("profile") || text.includes("profile")) {
    return "/(tabs)/profile";
  }

  // 12. Bills & Airtime
  if (raw.includes("bill") || raw.includes("data") || raw.includes("airtime") || text.includes("airtime")) {
    return "/(tabs)/bills";
  }

  // 13. General Services Hub
  if (raw.includes("service") || text.includes("service")) {
    return "/(tabs)/services";
  }

  // Default safe landing
  return "/(tabs)";
}
