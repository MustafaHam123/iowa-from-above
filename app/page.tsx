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
        <h1>Iowa From Above: an interactive 3D Iowa history tour</h1>
        <p>
          Fly a virtual drone across Iowa to explore landmarks, communities,
          natural areas, transportation, agriculture, and local history. Each
          stop combines a photorealistic aerial view with verified facts,
          narrated guidance, questions, and a detailed exhibit article.
        </p>
        <nav aria-label="Iowa landmark exhibits">
          <h2>Explore Iowa landmarks</h2>
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
