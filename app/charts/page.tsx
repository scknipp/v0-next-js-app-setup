import type { Metadata } from 'next';
import { ChartsPage } from '@/components/charts/charts-page';

export const metadata: Metadata = {
  title: 'Charts — Texas Global Investments',
};

// The /charts route. Accepts ?symbol=XXXX so other sections can link straight to a chart.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string | string[] }>;
}) {
  const { symbol } = await searchParams;
  return <ChartsPage initialSymbol={typeof symbol === 'string' ? symbol : undefined} />;
}
