import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Car,
  CreditCard,
  FileCheck2,
  KeyRound,
  Sparkles,
  Wallet,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

const FEATURES = [
  {
    icon: Car,
    title: "Wide Vehicle Selection",
    description:
      "Browse a fleet of cars, SUVs, and tuk-tuks with clear KSh daily rates and real-time availability.",
  },
  {
    icon: CalendarCheck,
    title: "Instant Online Booking",
    description: "Pick your dates, add a driver if you need one, and your booking is reserved right away.",
  },
  {
    icon: Wallet,
    title: "Flexible Deposits & M-Pesa",
    description: "Confirm with a 30% deposit and pay via M-Pesa, card, bank transfer, or cash.",
  },
  {
    icon: FileCheck2,
    title: "VAT-Compliant Invoicing",
    description:
      "Every booking gets a proper tax invoice with our KRA PIN and VAT breakdown, downloadable as a PDF.",
  },
  {
    icon: BadgeCheck,
    title: "Manage Bookings Anywhere",
    description: "View your rental history, outstanding balances, and receipts from your account.",
  },
  {
    icon: Sparkles,
    title: "Built for Companies Too",
    description: "Corporate accounts can book on behalf of their team with the same invoicing trail.",
  },
];

const STEPS = [
  { step: "1", title: "Browse", description: "Explore available vehicles by location, type, and price.", icon: Car },
  { step: "2", title: "Book", description: "Choose your dates, add a driver, and confirm.", icon: CalendarCheck },
  { step: "3", title: "Pay", description: "Settle your deposit via M-Pesa and get your invoice.", icon: CreditCard },
  { step: "4", title: "Drive", description: "Pick up your vehicle and hit the road.", icon: KeyRound },
];

export default function LandingPage() {
  return (
    <div className="animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700 px-6 py-16 text-center text-white sm:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto max-w-2xl">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="size-3.5" />
            Kenya's simplest way to rent a ride
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Rent the Right Vehicle, Every Time
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-brand-50/90">
            A simple, transparent car rental platform for individuals and companies — book online,
            pay securely via M-Pesa, and get a proper VAT invoice for every rental.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="bg-white! text-brand-700! hover:bg-brand-50! shadow-lg">
                Get Started
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="ghost" className="text-white! hover:bg-white/10!">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-text sm:text-3xl">Why Rent With Us</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="p-5 transition-shadow hover:shadow-md">
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <feature.icon className="size-5" />
              </div>
              <h3 className="font-semibold text-text">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="pb-16 sm:pb-20">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-text sm:text-3xl">How It Works</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.step} className="text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                <s.icon className="size-6" />
              </div>
              <h3 className="font-semibold text-text">
                {s.step}. {s.title}
              </h3>
              <p className="mt-1 text-sm text-muted">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16 rounded-2xl border border-border bg-surface px-6 py-12 text-center sm:mb-20">
        <h2 className="text-2xl font-bold text-text">Ready to book your next ride?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Create an account in minutes and reserve a vehicle today.
        </p>
        <Link to="/register" className="mt-6 inline-block">
          <Button size="lg">
            Create an Account
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
