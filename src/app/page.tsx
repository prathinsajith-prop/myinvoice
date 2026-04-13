import Link from "next/link";
import { FileText, Shield, Globe, Zap, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  {
    icon: FileText,
    title: "Professional Invoices",
    description: "Create beautiful, UAE-compliant invoices in seconds with our intuitive editor.",
  },
  {
    icon: Shield,
    title: "FTA VAT Compliant",
    description: "Automatic VAT calculations and reports ready for Federal Tax Authority submission.",
  },
  {
    icon: Globe,
    title: "Bilingual Support",
    description: "Full Arabic and English support with RTL layout for the UAE market.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Generate invoices, quotes, and reports instantly with our optimized platform.",
  },
];

const plans = [
  { name: "Free", price: "0", features: ["5 invoices/month", "1 user", "Basic reports"] },
  { name: "Starter", price: "49", features: ["50 invoices/month", "3 users", "VAT reports", "Email support"] },
  { name: "Professional", price: "149", features: ["Unlimited invoices", "10 users", "Advanced analytics", "Priority support"] },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">myinvoice.ae</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto flex flex-col items-center px-4 py-24 text-center">
        <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium mb-6">
          🇦🇪 Built for UAE Businesses
        </div>
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
          Professional Invoicing for{" "}
          <span className="text-primary">UAE Businesses</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Create FTA-compliant invoices, manage VAT, and get paid faster. 
          The complete e-invoicing solution designed specifically for Dubai and UAE businesses.
        </p>
        <div className="mt-10 flex gap-4">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/50 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold">
            Everything you need to manage invoices
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            Powerful features built for UAE compliance and efficiency
          </p>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-lg border bg-background p-6">
                <feature.icon className="h-10 w-10 text-primary" />
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold">Simple Pricing</h2>
          <p className="mt-4 text-center text-muted-foreground">
            Start free, upgrade when you need
          </p>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="rounded-lg border bg-background p-8"
              >
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">AED {plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-8 block">
                  <Button className="w-full" variant={plan.name === "Professional" ? "default" : "outline"}>
                    Get Started
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-semibold">myinvoice.ae</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 myinvoice.ae. UAE E-Invoicing Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
