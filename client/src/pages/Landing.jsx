import { useState } from "react";
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
          {/* <a href="#" className="hidden px-2 text-sm font-medium sm:block" style={{ color: "var(--muted)" }}>
            Log in
          </a> */}
             <Link to="/login" className="hidden px-2 text-sm font-medium sm:block" style={{ color: "var(--muted)" }}>
            Log in
          </Link>
          <button onClick={onGetStarted} className="pill pill-navy">Get started</button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */
const chips = ["WhatsApp Based", "AI Trust Score", "Voice First"];

function Hero({ onGetStarted }) {
  return (
    <section className="mx-auto grid max-w-300 items-center gap-12 px-5 pt-14 pb-20 sm:px-8 lg:grid-cols-2 lg:gap-8 lg:pt-24 lg:pb-28">
      <div className="text-center lg:text-left">
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
            <span key={c} className="rounded-full bg-white px-4 py-2 text-sm font-medium shadow-sm">✓ {c}</span>
          ))}
        </div>
      </div>

      <div className="flex justify-center lg:justify-end">
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
    <section style={{ background: "var(--navy)", color: "#fff" }}>
      <div className="mx-auto grid max-w-300 gap-8 px-5 py-12 text-center sm:grid-cols-3 sm:px-8">
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
    <section className="mx-auto max-w-300 px-5 py-16 sm:px-8 sm:py-24">
      <h2 className="mx-auto max-w-2xl text-center text-3xl font-extrabold tracking-tight sm:text-5xl">
        How it works
      </h2>
      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="card-soft p-7">
            <span className="grid h-11 w-11 place-items-center rounded-full text-lg font-extrabold"
              style={{ background: s.bg, color: s.fg, fontFamily: "'Playfair Display', serif" }}>
              {s.n}
            </span>
            <h3 className="mt-6 text-lg font-bold">{s.t}</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Features ---------------- */
const features = [
  { t: "Voice-first, in Urdu", d: "No typing or reading required. Anyone can use it." },
  { t: "Dynamic trust score", d: "Builds automatically from real payment behaviour." },
  { t: "Early fraud warning", d: "Members are alerted before a default happens, not after." },
  { t: "Simple dashboard", d: "Organizers see every committee in one clear view." },
];

function Features() {
  return (
    <section className="mx-auto max-w-300 px-5 pb-16 sm:px-8 sm:pb-24">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

/* ---------------- CTA ---------------- */
function CallToAction({ onGetStarted }) {
  return (
    <section className="mx-auto max-w-300 px-5 pb-16 sm:px-8 sm:pb-20">
      <div className="rounded-4xl px-7 py-14 text-center sm:px-14 sm:py-20" style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <h2 className="mx-auto max-w-3xl text-[2rem] leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
          Make your committee safer today
        </h2>
        <p className="mt-4 text-base opacity-70">Setup takes about two minutes.</p>
        <button onClick={onGetStarted} className="pill mt-8" style={{ background: "var(--sand)", color: "var(--ink)" }}>
          Create your committee
        </button>
        
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function SiteFooter() {
  return (
    <footer className="mx-auto max-w-300 border-t px-5 py-8 text-center text-xs sm:px-8"
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
      <CallToAction onGetStarted={open} />
      <SiteFooter />
      <RegistrationModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
