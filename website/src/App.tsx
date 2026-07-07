import { Navbar } from "@/components/Navbar";
import { ScrollProgress } from "@/components/shared/ScrollProgress";
import { GradientBg } from "@/components/shared/GradientBg";
import { InkParticles } from "@/components/shared/InkParticles";
import { CursorGlow } from "@/components/shared/CursorGlow";
import { CustomCursor } from "@/components/CustomCursor";
import { InkLandscape } from "@/components/shared/InkLandscape";
import { Hero } from "@/components/Hero";
import { SectionDivider } from "@/components/SectionDivider";
import { Philosophy } from "@/components/Philosophy";
import { Features } from "@/components/Features";
import { AgentDemo } from "@/components/AgentDemo";
import { MotionLab } from "@/components/MotionLab";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default function App() {
  return (
    <div id="top" className="relative min-h-screen bg-ink text-paper overflow-x-hidden">
      <GradientBg />
      <InkParticles />
      <CursorGlow />
      <CustomCursor />
      <ScrollProgress />
      <Navbar />
      <main className="relative z-10">
        <Hero />
        {/* 水墨山水过渡 */}
        <div className="relative -mb-20 z-0 opacity-60">
          <InkLandscape variant="mountain" />
        </div>
        <Philosophy />
        <SectionDivider />
        {/* 水墨云气 */}
        <div className="relative -my-10 opacity-40 pointer-events-none">
          <InkLandscape variant="cloud" />
        </div>
        <Features />
        <AgentDemo />
        {/* 水墨水面过渡 */}
        <div className="relative -mb-10 opacity-50 pointer-events-none">
          <InkLandscape variant="water" />
        </div>
        <MotionLab />
        <CTA />
        <Footer />
      </main>
    </div>
  );
}
