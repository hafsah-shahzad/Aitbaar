import { useState } from "react";
import { Link } from "react-router-dom";
import "./HowItWorks.css";
// This page is self-contained -- its own CSS file has everything it needs,
// including its own copy of the "btn-primary-lg" button style.

const organizerSteps = [
  {
    title: "Create your committee",
    desc: "Fill in your name, email, and committee details (amount, members, duration). Takes about two minutes.",
    example: "Example: \"1 Lakh Committee\"  Rs 100,000/month, 10 members",
  },
  {
    title: "Get your committee code",
    desc: "You'll instantly receive a unique code (like C-P417VL) on screen and by email. This is what your members use to join.",
  },
  {
    title: "Share the code on WhatsApp",
    desc: "Send your members the Aitbaar bot number and your committee code the same way you'd normally tell them about the committee.",
  },
  {
    title: "Watch your dashboard",
    desc: "As members confirm payments by voice, your dashboard updates automatically trust scores, payment status, and any warnings.",
  },
];

const memberSteps = [
  {
    title: "Save the Aitbaar number",
    desc: "Your organizer will share a WhatsApp number and a committee code with you no app to download.",
  },
  {
    title: "Send your committee code",
    desc: "Message the code once as a voice note or text to join your committee.",
    example: "Just say: \"C-P417VL\"",
  },
  {
    title: "Confirm payments by voice",
    desc: "Every month, send a short voice note confirming your payment in Urdu, just like talking to a friend.",
    example: "Say: \"Maine is mahine ke paisay de diye\"",
  },
  {
    title: "Ask your trust score anytime",
    desc: "Curious how you're doing? Just ask, and Aitbaar replies back in voice.",
    example: "Say: \"Mera trust score kya hai?\"",
  },
];

export default function HowItWorks() {
  const [activeTab, setActiveTab] = useState("organizer");
  const steps = activeTab === "organizer" ? organizerSteps : memberSteps;

  return (
    <div className="hiw-page">
      <nav className="hiw-nav">
        <Link to="/" className="hiw-back-link">&larr; Back to home</Link>
      </nav>

      <header className="hiw-header">
        <h1 className="hiw-title font-display">How Aitbaar works</h1>
        <p className="hiw-subtitle">
          A simple walkthrough for both committee organizers and members
          no technical knowledge needed.
        </p>
      </header>

      <div className="hiw-tabs">
        <button
          onClick={() => setActiveTab("organizer")}
          className={`hiw-tab ${activeTab === "organizer" ? "hiw-tab-active" : "hiw-tab-inactive"}`}
        >
          I'm an organizer
        </button>
        <button
          onClick={() => setActiveTab("member")}
          className={`hiw-tab ${activeTab === "member" ? "hiw-tab-active" : "hiw-tab-inactive"}`}
        >
          I'm a member
        </button>
      </div>

      <div className="hiw-steps">
        {steps.map((step, i) => (
          <div className="hiw-step" key={step.title}>
            <div className="hiw-step-number">{i + 1}</div>
            <div>
              <h3 className="hiw-step-title">{step.title}</h3>
              <p className="hiw-step-desc">{step.desc}</p>
              {step.example && <span className="hiw-example">{step.example}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="hiw-cta">
        <Link to="/" className="btn-primary-lg">
          {activeTab === "organizer" ? "Create your committee" : "Back to home"}
        </Link>
      </div>
    </div>
  );
}