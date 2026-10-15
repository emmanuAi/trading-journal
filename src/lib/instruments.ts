export interface Instrument {
  symbol: string;
  label: string;
  group: "Forex Major" | "Forex Minor" | "Metals" | "Energy" | "Index" | "Custom";
  pipSize: number;
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: "EURUSD", label: "EUR/USD", group: "Forex Major", pipSize: 0.0001 },
  { symbol: "GBPUSD", label: "GBP/USD", group: "Forex Major", pipSize: 0.0001 },
  { symbol: "USDJPY", label: "USD/JPY", group: "Forex Major", pipSize: 0.01 },
  { symbol: "USDCHF", label: "USD/CHF", group: "Forex Major", pipSize: 0.0001 },
  { symbol: "USDCAD", label: "USD/CAD", group: "Forex Major", pipSize: 0.0001 },
  { symbol: "AUDUSD", label: "AUD/USD", group: "Forex Major", pipSize: 0.0001 },
  { symbol: "NZDUSD", label: "NZD/USD", group: "Forex Major", pipSize: 0.0001 },
  { symbol: "EURGBP", label: "EUR/GBP", group: "Forex Minor", pipSize: 0.0001 },
  { symbol: "EURJPY", label: "EUR/JPY", group: "Forex Minor", pipSize: 0.01 },
  { symbol: "GBPJPY", label: "GBP/JPY", group: "Forex Minor", pipSize: 0.01 },
  { symbol: "AUDJPY", label: "AUD/JPY", group: "Forex Minor", pipSize: 0.01 },
  { symbol: "AUDNZD", label: "AUD/NZD", group: "Forex Minor", pipSize: 0.0001 },
  { symbol: "EURAUD", label: "EUR/AUD", group: "Forex Minor", pipSize: 0.0001 },
  { symbol: "GBPAUD", label: "GBP/AUD", group: "Forex Minor", pipSize: 0.0001 },
  { symbol: "NZDJPY", label: "NZD/JPY", group: "Forex Minor", pipSize: 0.01 },
  { symbol: "EURCHF", label: "EUR/CHF", group: "Forex Minor", pipSize: 0.0001 },
  { symbol: "GBPCHF", label: "GBP/CHF", group: "Forex Minor", pipSize: 0.0001 },
  { symbol: "CADJPY", label: "CAD/JPY", group: "Forex Minor", pipSize: 0.01 },
  { symbol: "CHFJPY", label: "CHF/JPY", group: "Forex Minor", pipSize: 0.01 },
  { symbol: "XAUUSD", label: "Gold (XAU/USD)", group: "Metals", pipSize: 0.01 },
  { symbol: "XAGUSD", label: "Silver (XAG/USD)", group: "Metals", pipSize: 0.001 },
  { symbol: "USOIL", label: "Crude Oil (WTI)", group: "Energy", pipSize: 0.01 },
  { symbol: "UKOIL", label: "Brent Oil", group: "Energy", pipSize: 0.01 },
  { symbol: "US500", label: "S&P 500", group: "Index", pipSize: 0.1 },
  { symbol: "NAS100", label: "NASDAQ 100", group: "Index", pipSize: 0.1 },
  { symbol: "US30", label: "Dow Jones 30", group: "Index", pipSize: 0.1 },
  { symbol: "GER40", label: "DAX 40", group: "Index", pipSize: 0.1 },
];

export function findInstrument(symbol: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.symbol.toUpperCase() === symbol.toUpperCase());
}
