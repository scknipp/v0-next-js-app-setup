'use client';

import { useEffect, useRef, memo } from 'react';

/**
 * TradingViewWidget
 * A small reusable wrapper around TradingView's free embeddable widgets.
 * TradingView widgets work by injecting a <script> tag (with a JSON config)
 * into a container div — there's no npm package, this is how TradingView's
 * own embed code works. No API key, no account, no cost.
 */
interface TradingViewWidgetProps {
  scriptSrc: string;
  config: Record<string, unknown>;
  height: string;
}

function TradingViewWidget({ scriptSrc, config, height }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    // Clear out any previous widget before re-inserting (e.g. on re-render).
    el.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    el.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    el.appendChild(script);

    return () => {
      el.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptSrc, JSON.stringify(config)]);

  return (
    <div
      className="tradingview-widget-container"
      ref={container}
      style={{ height, width: '100%' }}
    />
  );
}

const MemoizedTradingViewWidget = memo(TradingViewWidget);

/** Scrolling ticker tape across the top of the Stocks page. */
function TickerTape() {
  const config = {
    symbols: [
      { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
      { proName: 'NASDAQ:AAPL', title: 'Apple' },
      { proName: 'NASDAQ:MSFT', title: 'Microsoft' },
      { proName: 'NASDAQ:GOOGL', title: 'Alphabet' },
      { proName: 'NASDAQ:AMZN', title: 'Amazon' },
      { proName: 'NASDAQ:TSLA', title: 'Tesla' },
      { proName: 'NASDAQ:NVDA', title: 'Nvidia' },
      { proName: 'NYSE:JPM', title: 'JPMorgan' },
    ],
    showSymbolLogo: true,
    colorTheme: 'light',
    isTransparent: false,
    displayMode: 'adaptive',
    locale: 'en',
  };

  return (
    <MemoizedTradingViewWidget
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
      config={config}
      height="46px"
    />
  );
}

/** Full interactive chart — defaults to AAPL, symbol search enabled. */
function AdvancedChart() {
  const config = {
    autosize: true,
    symbol: 'NASDAQ:AAPL',
    interval: 'D',
    timezone: 'America/Chicago',
    theme: 'light',
    style: '1',
    locale: 'en',
    withdateranges: true,
    hide_side_toolbar: false,
    allow_symbol_change: true,
    details: true,
    hotlist: false,
    calendar: false,
    support_host: 'https://www.tradingview.com',
  };

  return (
    <MemoizedTradingViewWidget
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
      config={config}
      height="100%"
    />
  );
}

export function StocksPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-navy-dark mb-2">Stocks</h2>
        <p className="text-gray-600 text-lg leading-relaxed">
          Research and analyze stocks with real-time data and comprehensive metrics.
        </p>
      </div>

      {/* Scrolling ticker tape */}
      <div className="rounded-lg overflow-hidden border border-gray-200 mb-4 bg-white">
        <TickerTape />
      </div>

      {/* Interactive chart */}
      <div className="flex-1 min-h-[520px] rounded-xl overflow-hidden border border-gray-200 bg-white">
        <AdvancedChart />
      </div>
    </div>
  );
}
