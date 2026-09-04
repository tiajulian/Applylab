import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { TESTIMONIALS } from "@/lib/marketingBridgeData";

export function FounderAndTestimonialSection() {
  const danielK = TESTIMONIALS[0];

  return (
    <section id="proof" className="sec bg-paper border-b border-border/60">
      <Container size="marketing">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Left: Founder Note with Organic Mask Drop Target */}
          <div className="lg:col-span-7 flex flex-col justify-between market-card p-6 sm:p-10 bg-surface">
            <Reveal>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Masked Photo Drop Target (Organic rounded container with wash) */}
                <div
                  className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-2xl bg-paper-deep border border-border flex items-center justify-center text-ink-muted overflow-hidden shadow-sm"
                  aria-label="Founder photo slot"
                >
                  {/* Subtle organic mask backdrop with monogram fallback */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-accent/15 to-transparent" />
                  <span className="font-display font-bold text-2xl text-ink">JT</span>
                </div>
                <div>
                  <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                    Founder Note
                  </span>
                  <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-ink">
                    Why we built ApplyLab for Australia.
                  </h3>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-xs sm:text-sm text-ink-secondary leading-relaxed">
                <p>
                  I built ApplyLab after going through the Australian job hunt myself. Like many people, I tried using generic AI tools to help draft applications, only to find them inventing fake metrics, defaulting to American jargon, and hallucinating skills I never possessed.
                </p>
                <p>
                  Walking into an Australian panel interview knowing your resume contains exaggerations you cannot defend is terrifying. Australian hiring managers spot generic buzzwords instantly.
                </p>
                <p>
                  ApplyLab was created on one core principle: strict fact traceability. You build your verified career profile once, and everything we generate traces back to what you actually did. No hallucinations, no generic fluff, just defensible applications built for how Australia hires.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="font-bold text-ink text-sm">Julian Tia</p>
                  <p className="text-xs text-ink-muted">Founder &middot; ApplyLab Australia</p>
                </div>
                <span className="text-xs font-semibold text-accent">Sydney, Australia 🇦🇺</span>
              </div>
            </Reveal>
          </div>

          {/* Right: Real Testimonial (Daniel K.) */}
          <div className="lg:col-span-5 flex flex-col justify-between market-card p-6 sm:p-8 bg-paper-deep/30">
            <Reveal delay={0.15}>
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
                  <span className="rounded bg-success-soft px-2.5 py-0.5 text-[10px] font-bold text-success border border-success/30">
                    Verified Outcome
                  </span>
                  <span className="text-xs text-ink-muted">{danielK?.location ?? "Brisbane, QLD"}</span>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  {/* Portrait Drop Target */}
                  <div
                    className="h-12 w-12 shrink-0 rounded-full bg-surface border border-border flex items-center justify-center font-display font-bold text-ink text-sm shadow-sm"
                    aria-label="Daniel K portrait slot"
                  >
                    DK
                  </div>
                  <div>
                    <h4 className="font-display text-base font-bold text-ink">
                      {danielK?.name ?? "Daniel K."}
                    </h4>
                    <p className="text-xs text-ink-muted">
                      {danielK?.fromRole ?? "Retail Shift Supervisor"} &rarr; {danielK?.toRole ?? "Operations Analyst"}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-xs sm:text-sm text-ink-secondary italic leading-relaxed">
                  &ldquo;{danielK?.before ?? "Applying on Workday and SEEK was a painful copy-paste marathon, and generic ChatGPT output sounded fake and full of US buzzwords."}&rdquo;
                </p>

                <p className="mt-3 text-xs sm:text-sm text-ink font-medium leading-relaxed">
                  &ldquo;{danielK?.after ?? "The Chrome extension autofilled my Australian details in one click, and the Interview Coach prepared me for tough scenario questions."}&rdquo;
                </p>
              </div>

              <div className="mt-8 rounded-lg border border-success/20 bg-success-soft p-3.5 flex items-start gap-2 text-xs">
                <CheckIcon className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-ink">Result: </span>
                  <span className="text-ink-secondary">
                    {danielK?.result ?? "4 interview invites out of 5 applications across SEEK and LinkedIn."}
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
