"use client";
import { useState } from "react";

/** Codes are generated at build time with Apple's Core Image; no QR API. */
export default function PlaceCompanion({ id, name, defaultOpen = false, onScan }: { id: string; name: string; defaultOpen?: boolean; onScan?: () => void }) {
  const [open, setOpen] = useState(defaultOpen);
  return <div className="place-companion">
    <div className="place-companion__actions">
      <button className="place-companion__trigger" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`place-qr-${id}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 14v3h3v4M21 13v3M12 3v3M12 10v3H9M3 12h3M12 18v3M21 20h-1M18 11h3" /></svg>
        Send to phone
      </button>
      {onScan && <button className="place-companion__scan" onClick={onScan} aria-label="Scan a place QR code" title="Open a code from your phone">Scan QR</button>}
    </div>
    {open && <div className="place-companion__code" id={`place-qr-${id}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/companion/${id}.png`} width={144} height={144} alt={`QR code to open ${name} in From Above`} />
      <div><p>Same place.<br />On your phone.</p><small>In From Above, tap Scan website.</small><a href={`fromabove://place/${id}`}>Open app ↗</a></div>
    </div>}
  </div>;
}
