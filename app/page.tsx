import Link from "next/link";
import { EXHIBITS } from "./exhibits";
import IowaMapShell from "./IowaMapShell";
import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from "./site";

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: getSiteUrl(),
    description: SITE_DESCRIPTION,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any modern web browser",
    inLanguage: "en-US",
    author: {
      "@type": "Person",
      name: "Mustafa Hameed",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="sr-only" aria-label="About Iowa From Above">
        <h1>Iowa From Above: Iowa’s environmental challenges</h1>
        <p>
          Explore Iowa’s water-quality challenges, agricultural runoff, flood
          exposure and habitat protection through twelve place-based lessons.
          Inspect official USGS observations and FEMA maps, then learn what
          conservation and restoration can help communities do.
        </p>
        <nav aria-label="Iowa environmental lessons">
          <h2>Explore Iowa’s environmental issues</h2>
          <ul>
            {EXHIBITS.map((exhibit) => (
              <li key={exhibit.id}>
                <Link href={`/exhibits/${exhibit.id}`}>{exhibit.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
      <IowaMapShell />
    </>
  );
}
