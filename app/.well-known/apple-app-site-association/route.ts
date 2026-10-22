// Must be deployed on the domain listed in the iOS Associated Domains entitlement.
export const dynamic = "force-static";
export function GET() {
  return Response.json({ applinks: { details: [{ appIDs: ["74SA4D686B.com.iowa.fromabove"], components: [{ "/": "/places/*", comment: "Open a shared environmental place" }] }] } });
}
