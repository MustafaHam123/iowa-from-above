import Link from "next/link";
import { notFound } from "next/navigation";
import { EXHIBITS, EXHIBIT_BY_ID } from "../../exhibits";
import PlaceCompanion from "../../PlaceCompanion";
export const dynamicParams = false;
export function generateStaticParams() { return EXHIBITS.map(({ id }) => ({ id })); }
export default async function PlaceLanding({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const place = EXHIBIT_BY_ID[id]; if (!place) notFound();
  return <main className="place-landing"><article className="journey-panel">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="place-landing__brand" src="/icon.png" width={48} height={48} alt="Iowa From Above" />
    <p>{place.location}</p><h1>{place.name}</h1><p>{place.summary}</p>
    <div className="place-landing__actions"><Link className="journey-answer" href={`/?place=${id}`}>Explore in 3D ↗</Link></div>
    <PlaceCompanion id={id} name={place.name} defaultOpen />
    <details><summary>About this place</summary><p>{place.statistic.detail}</p>{place.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</details>
  </article></main>;
}
