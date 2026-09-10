import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EXHIBIT_BY_ID, EXHIBITS } from "../../exhibits";

type ExhibitPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return EXHIBITS.map((exhibit) => ({ id: exhibit.id }));
}

export async function generateMetadata({ params }: ExhibitPageProps): Promise<Metadata> {
  const { id } = await params;
  const exhibit = EXHIBIT_BY_ID[id];

  if (!exhibit) return {};

  return {
    title: `${exhibit.name} | Iowa From Above`,
    description: exhibit.summary,
  };
}

export default async function ExhibitPage({ params }: ExhibitPageProps) {
  const { id } = await params;
  const exhibit = EXHIBIT_BY_ID[id];

  if (!exhibit) notFound();

  return (
    <main className="exhibit-article-page">
      <article className="exhibit-article">
        <nav aria-label="Exhibit navigation" className="exhibit-article__nav">
          <Link href="/">Return to the flight</Link>
          <span>{EXHIBITS.findIndex((item) => item.id === exhibit.id) + 1} / {EXHIBITS.length}</span>
        </nav>

        <header className="exhibit-article__header">
          <h1>{exhibit.name}</h1>
          <p>{exhibit.location}</p>
        </header>

        <div className="exhibit-article__copy" id="overview">
          <p className="exhibit-article__lead">{exhibit.summary}</p>
          <p>{exhibit.article.intro}</p>

          <figure className="exhibit-article__figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={exhibit.image.url} alt={exhibit.image.alt} />
            <figcaption>
              {exhibit.image.alt}. Image: <a href={exhibit.image.source} target="_blank" rel="noreferrer">{exhibit.image.credit}</a>
            </figcaption>
          </figure>

          <p>{exhibit.article.story}</p>
          <p id="fact">{exhibit.funFact}</p>
          <p id="statistic"><strong>{exhibit.statistic.value} {exhibit.statistic.label}.</strong> {exhibit.statistic.detail}</p>
          <p>{exhibit.article.importance}</p>
          <p>{exhibit.article.lookFor}</p>
        </div>

        <footer className="exhibit-article__sources">
          <p>Sources</p>
          {exhibit.sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
          ))}
        </footer>
      </article>
    </main>
  );
}
