import MarketingSiteFrame from "@/components/marketing-site-frame";

export default function AssessmentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <MarketingSiteFrame>{children}</MarketingSiteFrame>;
}

