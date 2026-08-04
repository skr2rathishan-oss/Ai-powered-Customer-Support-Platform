const AVATARS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAbZZwLdr-5P5qEjXnMf8j8nxT_blX4s6TCxYpSPqQBqv20yAd4Qtvqn2smIHayvbMGC6Z3JxW188JzunRokIY-gEx3HS2BvK4xjjoybVbAX-Axez5yiRW5mVLOPtQCNVRSkiWPIFyJoIiZanhlQYpwTigZ7ZIhKURzJry8gfTuxcsS0KS0TroAcirVIoyOE-eAut2U2rGhkNBKJai_V3vrlkqfiYRN1iL_pSODCTNYKRsJ-HV_iGjn",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuALvuWqeQiIBkPY7zpTKyCHjTlLNMJV4BlZuEoxyNePs9scZ4jV8ckC7AnDFT-sDGasEWeTbLOF7TqSI9x_sQ7tS1v5IeWbG3rKDVD0vaztTuh8so3J85dZwVYwlplpkKYMObQKcTQmZXYZDQKdMc46wgTjr9PzcXdIAH4LYRCAiXMdlODmwTk1EUiTWeGId-KP-l6nZXoT62BTQefqV0PotfkNNzLQqw0bvBEgKNLB7NxqDWgLEKvq",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuApEDlxkCkemcrRSx4JGVWZ8kHXL-6VlyIq_lm5s5Vs7iQHXhgPv2ACWp7rDQOhiLzqBunReuB4CDRxGzty-E9FlJI55Xrmzd_P7SoBu09VyhMvqmW4GuLnkmKFkFZ1pxODjsVdEEosQZIB55nSkng3IaX7u1CiTDEjPeMkXg1776aZhOEn6wLD_PUPj2_7AuQOMSjb7E9YtOZY3PcaDytW--COYpWeZ2x7dRXCtqgDfnmwx4R7G4si",
];

export function ProductShowcase() {
  return (
    <aside className="product-showcase" aria-label="SupportPilot product preview">
      <div className="product-showcase__image" aria-hidden="true" />
      <div className="product-showcase__shade" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--top" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--bottom" aria-hidden="true" />

      <article className="testimonial-card">
        <header className="testimonial-card__header">
          <span className="sparkle-icon" aria-hidden="true">✦</span>
          <h2>SupportPilot AI</h2>
        </header>
        <p>
          Join 2,000+ enterprises optimizing their customer support workflow
          with our intelligent pilot assistant. From ticketing management to
          real-time agent workspace, we’ve got you covered.
        </p>
        <footer className="social-proof">
          <div className="avatar-stack" aria-hidden="true">
            {AVATARS.map((src, index) => (
              <img src={src} alt="" key={src} style={{ zIndex: 3 - index }} />
            ))}
          </div>
          <div>
            <strong>Trusted by world-class teams</strong>
            <div className="stars" aria-label="Five out of five stars">
              ★ ★ ★ ★ ★
            </div>
          </div>
        </footer>
      </article>
    </aside>
  );
}
