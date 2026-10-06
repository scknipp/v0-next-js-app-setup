'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  LineChart,
  Filter,
  List,
  History,
  FileText,
  Globe,
  Settings2,
  DollarSign,
  Bitcoin,
  Gem,
  BookOpen,
  Gamepad2,
  Church,
  ChevronRight,
} from 'lucide-react';
import { StocksPage } from '@/components/stocks-page';

export default function TexasGlobalInvestments() {
  const [activePage, setActivePage] = useState('stocks');
  const router = useRouter();

  // Charts has its own full-screen page at /charts; every other item swaps the middle content.
  const openPage = (id: string) => {
    if (id === 'charts') router.push('/charts');
    else setActivePage(id);
  };

  const menuItems = [
    { id: 'stocks', label: 'Stocks', icon: TrendingUp },
    { id: 'charts', label: 'Charts', icon: LineChart },
    { id: 'screener', label: 'Stock Screener', icon: Filter },
    { id: 'lists', label: 'Stock Lists', icon: List },
    { id: 'backtester', label: 'Back Tester', icon: History },
    { id: 'papertrading', label: 'Paper Trading', icon: FileText },
  ];

  const toolItems = [
    { id: 'markets', label: 'Markets', icon: Globe },
    { id: 'options', label: 'Options', icon: Settings2 },
    { id: 'forex', label: 'Forex', icon: DollarSign },
    { id: 'crypto', label: 'Crypto', icon: Bitcoin },
    { id: 'metals', label: 'Metals', icon: Gem },
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'chapel', label: 'Chapel', icon: Church },
  ];

  const renderContent = () => {
    if (activePage === 'stocks') {
      return <StocksPage />;
    }

    const pageContent: Record<string, { title: string; description: string; placeholder: string }> = {
      stocks: {
        title: 'Stocks',
        description: 'Research and analyze stocks with real-time data and comprehensive metrics.',
        placeholder: 'Stock Research Dashboard',
      },
      charts: {
        title: 'Charts',
        description: 'Advanced technical analysis with customizable charting tools.',
        placeholder: 'Advanced Charting Suite',
      },
      screener: {
        title: 'Stock Screener',
        description: 'Filter and discover stocks based on your custom criteria.',
        placeholder: 'Custom Stock Screener',
      },
      lists: {
        title: 'Stock Lists',
        description: 'Organize and manage your watchlists and portfolios.',
        placeholder: 'Watchlist Manager',
      },
      backtester: {
        title: 'Back Tester',
        description: 'Test trading strategies against historical market data.',
        placeholder: 'Strategy Backtester',
      },
      papertrading: {
        title: 'Paper Trading',
        description: 'Practice trading with simulated funds in real market conditions.',
        placeholder: 'Paper Trading Simulator',
      },
      markets: {
        title: 'Markets',
        description: 'Global market overview with live indices and economic data.',
        placeholder: 'Global Markets Dashboard',
      },
      options: {
        title: 'Options',
        description: 'Options chains, Greeks, and strategy builders.',
        placeholder: 'Options Trading Center',
      },
      forex: {
        title: 'Forex',
        description: 'Currency pairs, exchange rates, and FX analysis tools.',
        placeholder: 'Forex Trading Hub',
      },
      crypto: {
        title: 'Crypto',
        description: 'Cryptocurrency prices, charts, and market analysis.',
        placeholder: 'Crypto Market Center',
      },
      metals: {
        title: 'Metals',
        description: 'Precious metals pricing, trends, and investment analysis.',
        placeholder: 'Precious Metals Tracker',
      },
      library: {
        title: 'Library',
        description: 'Educational resources, tutorials, and market research.',
        placeholder: 'Learning Center',
      },
      games: {
        title: 'Games',
        description: 'Trading simulations and educational finance games.',
        placeholder: 'Trading Games',
      },
      chapel: {
        title: 'Chapel',
        description: 'A space for reflection, inspiration, and mindful trading.',
        placeholder: 'Reflection Space',
      },
    };

    const content = pageContent[activePage] || pageContent.stocks;

    return (
      <div className="h-full flex flex-col">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-navy-dark mb-2">
            {content.title}
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            {content.description}
          </p>
        </div>

        {/* Content Card */}
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-8 flex flex-col">
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Value', value: '$124,523.45', change: '+2.4%' },
              { label: 'Day Change', value: '+$1,234.56', change: '+1.2%' },
              { label: 'Open Positions', value: '12', change: '' },
              { label: 'Watchlist', value: '28', change: '' },
            ].map((stat, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm"
              >
                <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                <p className="text-xl font-semibold text-[#0a1f3c]">{stat.value}</p>
                {stat.change && (
                  <p className="text-sm text-emerald-600 font-medium">{stat.change}</p>
                )}
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#0a1f3c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <LineChart className="w-8 h-8 text-[#0a1f3c]" />
              </div>
              <p className="text-gray-400 text-lg font-medium">{content.placeholder}</p>
              <p className="text-gray-300 text-sm mt-1">Coming Soon</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a1f3c] text-white overflow-hidden">
      {/* Top Banner */}
      <header className="h-20 bg-gradient-to-r from-[#061528] via-[#0a1f3c] to-[#061528] border-b border-[#1e4060] flex items-center justify-center relative">
        {/* Decorative Lines */}
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/30 to-transparent" />
        <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/20 to-transparent" />
        
        {/* Logo Container */}
        <div className="flex items-center gap-4">
          {/* Texas Shape Emblem */}
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg 
              viewBox="0 0 100 100" 
              className="w-14 h-14"
            >
              {/* Detailed Texas outline - accurate state shape */}
              <path 
                d="M 5 5 L 5 35 L 15 35 L 15 5 L 5 5 M 15 5 L 15 35 L 38 35 L 38 15 L 70 15 L 70 25 L 80 25 L 80 30 L 85 35 L 90 42 L 88 50 L 92 55 L 95 62 L 90 70 L 82 72 L 78 80 L 70 85 L 60 90 L 50 95 L 42 92 L 35 88 L 30 82 L 25 78 L 22 70 L 18 65 L 15 55 L 15 35"
                fill="rgba(201, 162, 39, 0.15)"
                stroke="#c9a227"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            <TrendingUp className="w-5 h-5 text-[#c9a227] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/3" />
          </div>
          
          {/* Company Name */}
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold tracking-[0.3em] text-[#c9a227] uppercase">
              Texas Global Investments
            </h1>
            <p className="text-xs tracking-[0.2em] text-[#c9a227]/60 uppercase mt-0.5">
              Professional Trading Platform
            </p>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - MENU */}
        <aside className="w-56 bg-gradient-to-b from-[#0d2747] to-[#0a1f3c] border-r border-[#1e4060] flex flex-col">
          {/* Sidebar Header */}
          <div className="px-5 py-4 border-b border-[#1e4060]/50">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-[#c9a227] uppercase">
              Navigation
            </h2>
          </div>
          
          {/* Menu Items */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => openPage(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-all duration-200 group
                    ${isActive 
                      ? 'bg-[#c9a227] text-[#0a1f3c] shadow-lg shadow-[#c9a227]/20' 
                      : 'text-gray-300 hover:bg-[#1a3a5c] hover:text-white'}`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#0a1f3c]' : 'text-[#c9a227]'}`} />
                  <span className="flex-1 text-base">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Center Content Area */}
        <main className="flex-1 bg-white overflow-y-auto">
          <div className="p-8 h-full">
            {renderContent()}
          </div>
        </main>

        {/* Right Sidebar - TOOLS */}
        <aside className="w-56 bg-gradient-to-b from-[#0d2747] to-[#0a1f3c] border-l border-[#1e4060] flex flex-col">
          {/* Sidebar Header */}
          <div className="px-5 py-4 border-b border-[#1e4060]/50">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-[#c9a227] uppercase">
              Quick Access
            </h2>
          </div>
          
          {/* Tool Items */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {toolItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => openPage(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-all duration-200 group
                    ${isActive 
                      ? 'bg-[#c9a227] text-[#0a1f3c] shadow-lg shadow-[#c9a227]/20' 
                      : 'text-gray-300 hover:bg-[#1a3a5c] hover:text-white'}`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#0a1f3c]' : 'text-[#c9a227]'}`} />
                  <span className="flex-1 text-base">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </button>
              );
            })}
          </nav>
          
          {/* Footer */}
          <div className="p-4 border-t border-[#1e4060]/50">
            <div className="text-center text-xs text-gray-500">
              <p>v1.0.0</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
