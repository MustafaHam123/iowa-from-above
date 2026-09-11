export const SITE_NAME = "Iowa From Above";
export const SITE_DESCRIPTION =
  "Take to the skies in an interactive 3D tour of Iowa's landmarks, communities, landscapes, and stories.";

export function getSiteUrl() {
  const siteHost =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://iowa-from-above.vercel.app";

  return siteHost.startsWith("http") ? siteHost : `https://${siteHost}`;
}
