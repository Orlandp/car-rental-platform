import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Check,
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
      <section className="relative overflow-hidden px-6 py-20 text-center sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-2xl">
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
            <Check className="size-3.5" />
            Trusted by renters across Kenya
          </span>
          <h1 className="text-5xl leading-[1.05] text-text sm:text-6xl">
            Rent the right car, <em className="text-brand-600 italic">every time.</em>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            Transparent KSh pricing, verified vehicles, and instant confirmation with M-Pesa &mdash;
            no hidden fees, no surprises.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg">
                Get Started
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mb-16 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-4 rounded-2xl border border-border bg-surface px-8 py-6 sm:mb-20">
        <div className="flex items-center gap-2.5 text-sm font-medium text-muted">
          <CreditCard className="size-4 text-brand-500" /> M-Pesa accepted
        </div>
        <div className="flex items-center gap-2.5 text-sm font-medium text-muted">
          <BadgeCheck className="size-4 text-brand-500" /> Verified fleet
        </div>
        <div className="flex items-center gap-2.5 text-sm font-medium text-muted">
          <FileCheck2 className="size-4 text-brand-500" /> VAT invoicing built in
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl text-text">Why rent with us</h2>
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
          <h2 className="font-display text-3xl text-text">Booked in minutes</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.step} className="text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
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

      <section className="mb-16 rounded-3xl border border-border bg-gradient-to-br from-brand-100 to-surface px-6 py-14 text-center sm:mb-20 dark:from-brand-100 dark:to-bg">
        <h2 className="font-display text-3xl text-text">Ready for your next ride?</h2>
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
