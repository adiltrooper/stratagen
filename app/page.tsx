import Image from "next/image";
import ExportCard from "./components/ExportCard";

export default function Home() {
  const carouselImages = [
    "/images/routes/basic01.png",
    "/images/routes/bed.png",
    "/images/routes/middlefinger.png",
    "/images/routes/scribble.png",
  ];

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-4 sm:p-16">
      <main className="flex flex-col justify-center gap-[42px] row-start-2 items-center w-full max-w-[640px]">
        <div>
          <p>STRIVA</p>
          <p>None of the sweat. All of the flex.</p>
        </div>
        
        <ExportCard carouselImages={carouselImages} />
      </main>

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        
      </footer>
    </div>
  );
}
