import { useState, Fragment } from "react";
import RegistrationModal from "../components/RegistrationModal";
// import Logo from "../components/Logo";
import "./Landing.css";
import PhoneMockup from "../components/PhoneMockup";
import { Link } from "react-router-dom";
/* ---------------- Logo ---------------- */
function Logo({ size = 26 }) {
  return (
    <span className="font-urdu leading-none" style={{ fontSize: size, color: "var(--navy)" }} aria-hidden="true">
      اعتبار
    </span>
  );
}

/* ---------------- Navbar ---------------- */
function Navbar({ onGetStarted }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-[#faf7f2]/85 backdrop-blur-md" style={{ borderColor: "var(--line)" }}>
      <div className="mx-auto flex max-w-300 items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Aitbaar
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {/* <a href="#" className="px-2 text-sm font-medium" style={{ color: "var(--muted)" }}>
            Log in
          </a> */}
             <Link to="/login" className="px-2 text-sm font-medium hover:underline cursor-pointer" style={{ color: "var(--muted)" }}>
            Log in
          </Link>
          <Link to="/admin/login" className="px-2 text-sm font-medium hover:underline cursor-pointer" style={{ color: "var(--muted)" }} title="Platform staff login">
            Admin
          </Link>
          <button onClick={onGetStarted} className="pill pill-navy">Get started</button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */
const chips = [
  { label: "WhatsApp Based", bg: "#25D366", fg: "#fff" },
  { label: "AI Trust Score", bg: "#F59E0B", fg: "#fff" },
  { label: "Voice First", bg: "#7C3AED", fg: "#fff" },
];

function Hero({ onGetStarted }) {
  return (
    <section className="hero-section mx-auto grid max-w-300 items-center gap-12 px-5 pt-14 pb-20 sm:px-8 lg:grid-cols-2 lg:gap-8 lg:pt-24 lg:pb-28">
      <div className="relative z-10 text-center lg:text-left">
        <span className="inline-block rounded-full px-4 py-2 text-sm font-semibold"
          style={{ background: "rgba(240,217,168,.45)", color: "var(--amber)" }}>
          No app needed · Just your voice
        </span>

        <p dir="rtl" className="font-urdu mt-8 text-xl leading-[2.2] sm:text-2xl">
          ہر مشکل وقت کا بھروسے مند ساتھی
        </p>

        <h1 className="mt-3 text-[2.6rem] leading-[1.08] font-bold tracking-tight sm:text-[3.6rem]">
          Trust &amp; Safety for Every Savings Committee
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-[1.8] lg:mx-0" style={{ color: "var(--muted)" }}>
          Aitbaar helps committee organizers prevent fraud with AI trust scores, WhatsApp
          voice notes and real-time payment tracking. No downloads. No complicated setup.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
          <button onClick={onGetStarted} className="pill pill-navy">Create Committee</button>
              <Link to="/how-it-works" className="pill pill-outline">
        ▶ Watch Demo
      </Link>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-3 lg:justify-start">
          {chips.map((c) => (
            <span key={c.label} className="rounded-full px-4 py-2 text-sm font-semibold shadow-sm" style={{ background: c.bg, color: c.fg }}>
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex justify-center lg:justify-end">
        <PhoneMockup />
      </div>
    </section>
  );
}

/* ---------------- Stats ---------------- */
const stats = [
  { n: "41%", l: "of Pakistan uses committees" },
  { n: "0", l: "apps needed to join" },
  { n: "1", l: "voice note to start" },
];

function Stats() {
  return (
    <section className="stats-section-wrap" style={{ background: "var(--navy)", color: "#fff" }}>
      <div className="relative z-10 mx-auto grid max-w-300 gap-8 px-5 py-12 text-center sm:grid-cols-3 sm:px-8">
        {stats.map((s) => (
          <div key={s.l}>
            <p className="text-4xl font-bold sm:text-5xl" style={{ fontFamily: "'Playfair Display', serif" }}>{s.n}</p>
            <p className="mt-2 text-sm text-white/75">{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- How it works ---------------- */
const steps = [
  { n: "1", t: "Send a voice note", d: "Message Aitbaar on WhatsApp, just like texting a friend.", bg: "var(--navy)", fg: "#fff" },
  { n: "2", t: "AI understands it", d: "Payments, trust scores, and warning signs are handled automatically.", bg: "var(--sand)", fg: "var(--ink)" },
  { n: "3", t: "Get a voice reply", d: "Confirmations and alerts are spoken back in Urdu.", bg: "var(--navy)", fg: "#fff" },
];

function HowItWorks() {
  return (
    <section className="how-section-wrap mx-auto max-w-300 px-5 py-16 sm:px-8 sm:py-24">
      <h2 className="mx-auto max-w-2xl text-center text-3xl font-extrabold tracking-tight sm:text-5xl">
        How it works
      </h2>
      <div className="relative z-10 how-workflow">
        {steps.map((s, i) => (
          <Fragment key={s.n}>
            <div className="how-step-card">
              <div className="how-step-num-circle" style={{ background: s.bg, color: s.fg }}>{s.n}</div>
              <h3 className="how-step-title">{s.t}</h3>
              <p className="how-step-desc">{s.d}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="how-arrow">
                <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="0" y1="12" x2="36" y2="12" stroke="var(--line)" strokeWidth="2" strokeDasharray="6 4" />
                  <polygon points="36,6 48,12 36,18" fill="var(--navy)" />
                </svg>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Features ---------------- */
const features = [
  { t: "Voice-first, in Urdu", d: "No typing or reading required. Anyone can use it." },
  { t: "Early fraud warning", d: "Members are alerted before a default happens, not after." },
  { t: "Dynamic trust score", d: "Builds automatically from real payment behaviour." },
  { t: "Simple dashboard", d: "Organizers see every committee in one clear view." },
];

function Features() {
  return (
    <section className="features-section-wrap mx-auto max-w-300 px-5 pb-16 sm:px-8 sm:pb-24">
      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.t} className="card-soft p-6">
            <h3 className="text-base font-bold">{f.t}</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{f.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Trust & Safety ---------------- */
const trustItems = [
  { t: "AI Fraud Shield", d: "Real-time scam detection on every message and payment instruction." },
  { t: "Verified Trust Scores", d: "Built from actual payment history — not opinions or favouritism." },
  { t: "Secure by Design", d: "Phone-number verified identities. No fake accounts. No impersonation." },
];

function TrustAndSafety() {
  return (
    <section className="how-section-wrap mx-auto max-w-300 px-5 py-3 sm:px-8 sm:py-4">
      <h2 className="mx-auto max-w-2xl text-center text-3xl font-extrabold tracking-tight sm:text-5xl" style={{ color: "var(--navy)" }}>
        Trust &amp; Safety
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed" style={{ color: "var(--muted)" }}>
        Every committee member is verified. Every payment is tracked. AI monitors for fraud in real time — before it happens, not after.
      </p>
      <div className="relative z-10 how-workflow">
        {trustItems.map((item) => (
          <div key={item.t} className="trust-dark-card">
            <h3 className="trust-dark-title">{item.t}</h3>
            <p className="trust-dark-desc">{item.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}


/* ---------------- FAQ ---------------- */
const faqItems = [
  { q: "What is Aitbaar?", a: "Aitbaar is an AI-powered platform that helps savings committees manage payments, trust scores, and fraud detection — all through WhatsApp. No app downloads needed." },
  { q: "Do members need to download an app?", a: "No. Everything works through WhatsApp. Members send voice notes or text messages, and the AI bot handles the rest." },
  { q: "How does the AI trust score work?", a: "The trust score is calculated from real payment history — on-time payments increase it, late or missed payments decrease it. It reflects actual behaviour, not opinions." },
  { q: "Is my money safe?", a: "Aitbaar does not hold or transfer any money. It tracks and verifies payments between committee members. Your money stays with you and your committee." },
  { q: "Can I manage multiple committees?", a: "Yes. One WhatsApp number can be linked to multiple committees. Each committee's data — payments, trust scores, and payouts — stays completely separate." },
  { q: "What happens if someone doesn't pay?", a: "The AI detects early warning signs like missed payments or unusual patterns and alerts the organizer before it becomes a bigger problem." },
  { q: "How does fraud detection work?", a: "The AI scans messages for scam patterns, impersonation attempts, and suspicious requests — like someone claiming to be the organizer and asking for payments to a new account." },
  { q: "Is Aitbaar free?", a: "Basic features are free to use. Premium features may have a small fee — details will be shared when available." },
];

function FAQSection() {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <section className="faq-section-wrap mx-auto max-w-300 px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Frequently Asked Questions</h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: "var(--muted)" }}>
          Everything you need to know about Aitbaar.
        </p>
      </div>
      <div className="mx-auto mt-12 max-w-2xl">
        {faqItems.map((item, i) => (
          <div key={i} className="faq-item" style={{ borderBottom: "1px solid var(--line)" }}>
            <button
              className="faq-question"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
            >
              <span>{item.q}</span>
              <svg
                className="faq-chevron"
                style={{ transform: openIdx === i ? "rotate(180deg)" : "rotate(0)" }}
                width="20" height="20" viewBox="0 0 20 20" fill="none"
              >
                <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="faq-answer" style={{ maxHeight: openIdx === i ? "200px" : "0", opacity: openIdx === i ? 1 : 0 }}>
              <p>{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- CTA ---------------- */
function CallToAction({ onGetStarted }) {
  return (
    <section className="cta-section-wrap mx-auto max-w-300 px-5 pb-16 sm:px-8 sm:pb-20">
      <div className="relative overflow-hidden rounded-4xl px-7 py-16 text-center sm:px-14 sm:py-24" style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <h2 className="mx-auto max-w-3xl text-[2rem] leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
          Make your committee safer today
        </h2>
        <p className="mx-auto mt-5 max-w-md text-base opacity-70">Setup takes about two minutes. No downloads, no complicated setup.</p>
        <button onClick={onGetStarted} className="pill mt-10 relative z-10" style={{ background: "var(--sand)", color: "var(--ink)" }}>
          Create your committee
        </button>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function SiteFooter() {
  return (
    <footer className="footer-pattern mx-auto max-w-300 border-t px-5 pt-10 pb-8 text-center text-xs sm:px-8"
      style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
      Aitbaar — Alibaba Cloud AI Hackathon 2026
    </footer>
  );
}

/* ---------------- Registration Modal ---------------- */
// const fields = [
//   { label: "Your name", type: "text", placeholder: "Ali Raza" },
//   { label: "WhatsApp number", type: "tel", placeholder: "+92 300 0000000" },
//   { label: "Committee name", type: "text", placeholder: "Family kameti" },
// ];

// function RegistrationModal({ isOpen, onClose }) {
//   useEffect(() => {
//     const onKey = (e) => e.key === "Escape" && onClose();
//     document.addEventListener("keydown", onKey);
//     return () => document.removeEventListener("keydown", onKey);
//   }, [onClose]);

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 z-50 grid place-items-center p-5 backdrop-blur-sm"
//       style={{ background: "rgba(34,49,74,.5)" }} role="dialog" aria-modal="true" onClick={onClose}>
//       <div className="w-full max-w-md rounded-3xl border bg-white p-7 shadow-2xl"
//         style={{ borderColor: "var(--line)" }} onClick={(e) => e.stopPropagation()}>
//         <h2 className="text-2xl font-extrabold tracking-tight">Create your committee</h2>
//         <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Setup takes about two minutes.</p>

//         <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); onClose(); }}>
//           {fields.map((f) => (
//             <label key={f.label} className="block">
//               <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{f.label}</span>
//               <input required type={f.type} placeholder={f.placeholder}
//                 className="mt-1.5 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-(--navy)"
//                 style={{ borderColor: "var(--line)" }} />
//             </label>
//           ))}
//           <div className="flex gap-3 pt-2">
//             <button type="submit" className="pill pill-navy flex-1">Create committee</button>
//             <button type="button" onClick={onClose} className="pill pill-outline">Cancel</button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

/* ---------------- Page ---------------- */
export default function Landing() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const open = () => setIsFormOpen(true);

  return (
    <div className="aitbaar min-h-screen">
      <Navbar onGetStarted={open} />
      <Hero onGetStarted={open} />
      <Stats />
      <HowItWorks onGetStarted={open} />
      <Features />
      <TrustAndSafety />
      <FAQSection />
      <CallToAction onGetStarted={open} />
      <SiteFooter />
      <RegistrationModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
