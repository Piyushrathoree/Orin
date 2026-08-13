import { AnimatedSection } from "@/components/landing-latest/animated-section";
import { BentoSection } from "@/components/landing-latest/bento-section";
import { CTASection } from "@/components/landing-latest/cta-section";
import { DashboardPreview } from "@/components/landing-latest/dashboard-preview";
import { FAQSection } from "@/components/landing-latest/faq-section";
import { FooterSection } from "@/components/landing-latest/footer-section";
import { HeroSection } from "@/components/landing-latest/hero-section";
import { LargeTestimonial } from "@/components/landing-latest/large-testimonial";
import { PricingSection } from "@/components/landing-latest/pricing-section";
import { SocialProof } from "@/components/landing-latest/social-proof";
import { TestimonialGridSection } from "@/components/landing-latest/testimonial-grid-section";

const Page = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background pb-0">
      <div className="relative z-10">
        <main className="relative mx-auto max-w-[1320px]">
          <HeroSection />
          <div className="absolute bottom-[-180px] left-1/2 z-30 -translate-x-1/2 md:bottom-[-470px]">
            <AnimatedSection>
              <DashboardPreview />
            </AnimatedSection>
          </div>
        </main>

        <AnimatedSection
          className="relative z-10 mx-auto mt-[480px] max-w-[1320px] px-6 md:mt-[460px]"
          delay={0.1}
        >
          <SocialProof />
        </AnimatedSection>
        <AnimatedSection
          id="features-section"
          className="relative z-10 mx-auto mt-16 max-w-[1320px]"
          delay={0.2}
        >
          <BentoSection />
        </AnimatedSection>
        <AnimatedSection
          className="relative z-10 mx-auto mt-8 max-w-[1320px] md:mt-16"
          delay={0.2}
        >
          <LargeTestimonial />
        </AnimatedSection>
        <AnimatedSection
          id="pricing-section"
          className="relative z-10 mx-auto mt-8 max-w-[1320px] md:mt-16"
          delay={0.2}
        >
          <PricingSection />
        </AnimatedSection>
        <AnimatedSection
          id="testimonials-section"
          className="relative z-10 mx-auto mt-8 max-w-[1320px] md:mt-16"
          delay={0.2}
        >
          <TestimonialGridSection />
        </AnimatedSection>
        <AnimatedSection
          id="faq-section"
          className="relative z-10 mx-auto mt-8 max-w-[1320px] md:mt-16"
          delay={0.2}
        >
          <FAQSection />
        </AnimatedSection>
        <AnimatedSection
          className="relative z-10 mx-auto mt-8 max-w-[1320px] md:mt-16"
          delay={0.2}
        >
          <CTASection />
        </AnimatedSection>
        <AnimatedSection
          className="relative z-10 mx-auto mt-8 max-w-[1320px] md:mt-16"
          delay={0.2}
        >
          <FooterSection />
        </AnimatedSection>
      </div>
    </div>
  );
};

export default Page;
