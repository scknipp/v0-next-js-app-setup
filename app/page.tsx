'use client';

import { useState } from 'react';

export default function TexasGlobalInvestments() {
  const [activePage, setActivePage] = useState('stocks');

  const menuItems = [
    { id: 'stocks', label: 'Stocks' },
    { id: 'charts', label: 'Charts' },
    { id: 'screener', label: 'Stock Screener' },
    { id: 'lists', label: 'Stock Lists' },
    { id: 'backtester', label: 'Back Tester' },
    { id: 'papertrading', label: 'Paper Trading' },
  ];

  const toolItems = [
    { id: 'markets', label: 'Markets' },
    { id: 'options', label: 'Options' },
    { id: 'forex', label: 'Forex' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'metals', label: 'Metals' },
    { id: 'library', label: 'Library' },
    { id: 'games', label: 'Games' },
    { id: 'chapel', label: 'Chapel' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0d2747] text-white overflow-hidden">
      {/* Top Banner */}
      <div className="h-16 border-b-2 border-[#4a240b] bg-[#0d2747] flex items-center justify-center relative">
        <h1 
          className="text-3xl font-bold tracking-[6px] text-[#FFD43B]"
        >
          TEXAS GLOBAL INVESTMENTS
        </h1>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - MENU */}
        <div className="w-1/6 bg-[#0d2747] border-r border-[#4a240b] p-4 overflow-y-auto">
          <div className="text-[#FFD43B] font-bold text-sm tracking-widest mb-4 pl-2">MENU</div>
          <div className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full text-left px-4 py-3 rounded-md border border-[#4a240b] text-[#FFD43B] font-medium transition-all
                  ${activePage === item.id 
                    ? 'bg-[#8b4513] shadow-inner' 
                    : 'bg-[#6b3410] hover:bg-[#7a3e12]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Content Area - White Background */}
        <div className="flex-1 bg-white text-black overflow-y-auto p-8">
          {activePage === 'stocks' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Stocks</h2>
              <p className="text-lg text-gray-700">Stock lookup and research view will go here.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Stocks View - Coming Soon with Search + Chart ]
              </div>
            </div>
          )}

          {activePage === 'charts' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Charts</h2>
              <div className="p-8 border border-gray-300 rounded-xl text-center text-gray-500 h-96 flex items-center justify-center">
                Advanced Charting Area
              </div>
            </div>
          )}

          {activePage === 'screener' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Stock Screener</h2>
              <p className="text-lg text-gray-700">Filter and screen stocks based on your criteria.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Stock Screener - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'lists' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Stock Lists</h2>
              <p className="text-lg text-gray-700">Manage your watchlists and stock collections.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Stock Lists - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'backtester' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Back Tester</h2>
              <p className="text-lg text-gray-700">Test your trading strategies against historical data.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Back Tester - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'papertrading' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Paper Trading</h2>
              <p className="text-lg text-gray-700">Practice trading with virtual money.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Paper Trading - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'markets' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Markets</h2>
              <p className="text-lg text-gray-700">Overview of global market conditions.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Markets Overview - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'options' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Options</h2>
              <p className="text-lg text-gray-700">Options trading and analysis tools.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Options - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'forex' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Forex</h2>
              <p className="text-lg text-gray-700">Foreign exchange market data and trading.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Forex - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'crypto' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Crypto</h2>
              <p className="text-lg text-gray-700">Cryptocurrency market data and analysis.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Crypto - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'metals' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Metals</h2>
              <p className="text-lg text-gray-700">Precious metals market data.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Metals - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'library' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Library</h2>
              <p className="text-lg text-gray-700">Educational resources and documentation.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Library - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'games' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Games</h2>
              <p className="text-lg text-gray-700">Trading simulation games.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Games - Coming Soon ]
              </div>
            </div>
          )}

          {activePage === 'chapel' && (
            <div>
              <h2 className="text-3xl font-bold mb-6 text-black">Chapel</h2>
              <p className="text-lg text-gray-700">A place for reflection and inspiration.</p>
              <div className="mt-8 p-8 border border-gray-300 rounded-xl text-center text-gray-500">
                [ Chapel - Coming Soon ]
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - TOOLS */}
        <div className="w-1/6 bg-[#0d2747] border-l border-[#4a240b] p-4 overflow-y-auto">
          <div className="text-[#FFD43B] font-bold text-sm tracking-widest mb-4 pl-2">TOOLS</div>
          <div className="space-y-2">
            {toolItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full text-left px-4 py-3 rounded-md border border-[#4a240b] text-[#FFD43B] font-medium transition-all
                  ${activePage === item.id 
                    ? 'bg-[#8b4513] shadow-inner' 
                    : 'bg-[#6b3410] hover:bg-[#7a3e12]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
