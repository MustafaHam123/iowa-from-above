"use client";

import dynamic from "next/dynamic";
import IntroSequence from "./IntroSequence";
import TutorialGuide from "./TutorialGuide";

const IowaTileMap = dynamic(() => import("./IowaTileMap"), {
  ssr: false,
});

export default function IowaMapShell() {
  return (
    <>
      <IowaTileMap />
      <TutorialGuide />
      <IntroSequence />
      <section className="mobile-orientation-notice" aria-label="Rotate device">
        <span aria-hidden="true">↻</span>
        <p>Rotate your phone to play</p>
      </section>
    </>
  );
}
