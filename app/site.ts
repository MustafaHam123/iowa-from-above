export const SITE_NAME = "Iowa From Above";
export const SITE_DESCRIPTION =
  "Explore Iowa’s environmental challenges through real places, official water data, flood maps and practical conservation lessons.";

export function getSiteUrl() {
  const siteHost =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://iowa-from-above.vercel.app";

  return siteHost.startsWith("http") ? siteHost : `https://${siteHost}`;
}
