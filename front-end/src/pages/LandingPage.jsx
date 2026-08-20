import { Link } from "react-router-dom";
import "../styles/landing.css";

const FEATURES = [
  {
    title: "Wide Vehicle Selection",
    description:
      "Browse a fleet of cars, SUVs, and vans with clear daily rates and real-time availability.",
  },
  {
    title: "Instant Online Booking",
    description: "Pick your dates, confirm the vehicle, and your booking is reserved right away.",
  },
  {
    title: "Flexible Payments",
    description: "Pay via M-Pesa, card, bank transfer, or cash — track balances and receipts online.",
  },
  {
    title: "VAT-Compliant Invoicing",
    description:
      "Every booking gets a proper tax invoice with our KRA PIN and a 16% VAT breakdown, downloadable as a PDF.",
  },
  {
    title: "Manage Bookings Anywhere",
    description: "View your rental history, outstanding balances, and receipts from your account.",
  },
  {
    title: "Built for Companies Too",
    description: "Corporate accounts can book on behalf of their team with the same invoicing trail.",
  },
];

const STEPS = [
  { step: "1", title: "Browse", description: "Explore available vehicles and daily rates." },
  { step: "2", title: "Book", description: "Choose your dates and confirm your booking." },
  { step: "3", title: "Pay", description: "Settle payment securely and get your invoice." },
  { step: "4", title: "Drive", description: "Pick up your vehicle and hit the road." },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <h1>Rent the Right Vehicle, Every Time</h1>
        <p>
          A simple, transparent car rental platform for individuals and companies — book online,
          pay securely, and get a proper VAT invoice for every rental.
        </p>
        <div className="landing-hero-actions">
          <Link to="/register" className="landing-cta-primary">
            Get Started
          </Link>
          <Link to="/login" className="landing-cta-secondary">
            Login
          </Link>
        </div>
      </section>

      <section className="landing-features">
        <h2>Why Rent With Us</h2>
        <div className="landing-feature-grid">
          {FEATURES.map((feature) => (
            <div className="landing-feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-steps">
        <h2>How It Works</h2>
        <div className="landing-steps-grid">
          {STEPS.map((s) => (
            <div className="landing-step" key={s.step}>
              <span className="landing-step-number">{s.step}</span>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta-band">
        <h2>Ready to book your next ride?</h2>
        <p>Create an account in minutes and reserve a vehicle today.</p>
        <Link to="/register" className="landing-cta-primary">
          Create an Account
        </Link>
      </section>
    </div>
  );
}
