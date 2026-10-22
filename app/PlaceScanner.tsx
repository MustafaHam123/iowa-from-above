"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { parsePlaceLink } from "./companionLinks";

export default function PlaceScanner({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(false);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const stop = useCallback(() => { active.current = false; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; }, []);
  const consume = useCallback((value: string) => {
    const id = parsePlaceLink(value, window.location.origin);
    if (!id) { setMessage("Use a From Above place code or link."); return false; }
    stop(); window.location.assign(new URL(`/?place=${encodeURIComponent(id)}`, window.location.origin).href); return true;
  }, [stop]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => { stop(); previous?.focus({ preventScroll: true }); };
  }, [stop]);
  async function start() {
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) { setMessage("Camera scanning requires HTTPS or localhost. Choose a QR image instead."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (!dialog.current?.open || !video.current) { stop(); return; }
      video.current.srcObject = stream.current; await video.current.play(); active.current = true; setRunning(true);
      const { default: jsQR } = await import("jsqr");
      const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let last = 0;
      const scan = (now: number) => {
        if (!active.current) return;
        if (video.current && video.current.readyState >= 2 && now - last > 220) {
          last = now; canvas.width = 640; canvas.height = Math.round(640 * video.current.videoHeight / video.current.videoWidth);
          ctx.drawImage(video.current, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
          if (code && consume(code.data)) return;
        }
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    } catch { stop(); setRunning(false); setMessage("Camera unavailable. Choose a QR image or paste its link."); }
  }
  async function readImage(file?: File) {
    if (!file) return; stop(); setRunning(false); setMessage("Reading image…");
    try {
      const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const { default: jsQR } = await import("jsqr"); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(pixels.data, canvas.width, canvas.height);
      if (!code) setMessage("No QR found. Try a clearer image."); else consume(code.data);
    } catch { setMessage("Image unavailable. Try another image or paste the link."); }
  }
  return <dialog ref={dialog} className="place-scanner journey-panel" aria-label="Scan place QR" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="place-scanner__heading"><h2>Scan place QR</h2><button onClick={onClose} aria-label="Close scanner">×</button></div>
    <p>Bring a place from your app into 3D.</p>
    <video ref={video} muted playsInline hidden={!running} aria-label="QR camera preview" />
    {!running && <button className="journey-answer" onClick={() => void start()}>Start camera</button>}
    <details className="place-scanner__alternatives"><summary>More options</summary>
      <label className="place-scanner__file">Choose QR image<input type="file" accept="image/*" onChange={(event) => void readImage(event.target.files?.[0])} /></label>
      <form onSubmit={(event) => { event.preventDefault(); consume(text); }}><input aria-label="Place link" placeholder="Paste place link" value={text} onChange={(event) => setText(event.target.value)} /><button className="journey-answer" disabled={!text.trim()}>Open place</button></form>
    </details>
    <p role="status">{message}</p>
  </dialog>;
}
