import { Container } from "@/components/marketing/Container";

export function CredentialStrip() {
  return (
    <section className="band py-8 sm:py-10">
      <Container size="marketing">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-meta text-ink-muted">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-semibold uppercase tracking-wider text-xs">
            <span className="text-ink font-bold">Autofills</span>
            <span>&middot;</span>
            <span>SEEK</span>
            <span>&middot;</span>
            <span>LinkedIn</span>
            <span>&middot;</span>
            <span>Workday</span>
            <span>&middot;</span>
            <span>PageUp</span>
            <span>&middot;</span>
            <span>LiveHire</span>
          </div>
          <div className="text-xs sm:text-right font-medium text-ink-secondary">
            Faster than a ChatGPT workflow. Cheaper than a $350-600 resume writer.
          </div>
        </div>
      </Container>
    </section>
  );
}
