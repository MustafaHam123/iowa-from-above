import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found | Iowa From Above",
};

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-page__content">
        <p className="not-found-page__code">404</p>
        <h1>This route is off the map.</h1>
        <p>The page you were looking for does not exist or has moved.</p>
        <Link href="/">Return to Iowa From Above</Link>
      </div>
    </main>
  );
}
