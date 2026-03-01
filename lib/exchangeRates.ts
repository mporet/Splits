// A simple free-to-use exchange rate API without an API key using Open.Er-Api
// Uses "USD" as the default base currency usually, but we fetch all relative to it.

let cachedRates: Record<string, number> | null = null;
let lastFetchedTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 Hour

export async function fetchExchangeRates(): Promise<Record<string, number>> {
    if (cachedRates && (Date.now() - lastFetchedTime) < CACHE_DURATION) {
        return cachedRates;
    }

    try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!res.ok) throw new Error("Failed to fetch rates");

        const data = await res.json();
        if (data && data.rates) {
            cachedRates = data.rates;
            lastFetchedTime = Date.now();
            return cachedRates as Record<string, number>;
        }
        throw new Error("Invalid response form");
    } catch (error) {
        console.error("Error fetching exchange rates:", error);
        // Fallback dictionary for some common currencies to ensure the app works somewhat without internet
        // Or if the API is down.
        return cachedRates || {
            "USD": 1,
            "EUR": 0.95,
            "GBP": 0.82,
            "JPY": 150.00,
            "CAD": 1.40,
            "AUD": 1.55,
        };
    }
}

// Convert amount in `fromCurrency` to `toCurrency`
export async function convertCurrency(
    amountInCents: number,
    fromCurrency: string,
    toCurrency: string
): Promise<number> {
    if (fromCurrency === toCurrency) return amountInCents;

    const rates = await fetchExchangeRates();
    const rateFrom = rates[fromCurrency.toUpperCase()] || 1;
    const rateTo = rates[toCurrency.toUpperCase()] || 1;

    // Convert to USD first (base), then to target
    const amountInUSD = amountInCents / rateFrom;
    const convertedAmount = amountInUSD * rateTo;

    return Math.round(convertedAmount);
}
