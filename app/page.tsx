import Image from "next/image";
import ExportCard from "./components/ExportCard";
import Headline from "./components/Headline";

export default function Home() {
  const carouselImages = [
    "/images/routes/basic01.png",
    "/images/routes/bed.png",
    "/images/routes/middlefinger.png",
    "/images/routes/scribble.png",
  ];

  return (
    // Kept light on vertical padding: the card scales its Strava-proportioned stack to the height left over
    <div className="font-sans flex flex-col items-center justify-center min-h-[100dvh] px-4 pt-8 short:pt-4 pb-6 sm:py-10">
      <main className="flex flex-col justify-center gap-6 short:gap-4 sm:gap-8 items-center w-full max-w-[640px]">
        <Headline />

        <ExportCard carouselImages={carouselImages} />
      </main>
    </div>
  );
}
