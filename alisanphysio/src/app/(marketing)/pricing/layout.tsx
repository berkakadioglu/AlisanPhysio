import MarketingSiteFrame from "@/components/marketing-site-frame";

export default function PricingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <MarketingSiteFrame>{children}</MarketingSiteFrame>;
}

