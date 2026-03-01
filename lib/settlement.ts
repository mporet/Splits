// Settlement Algorithm implementation

export interface Transaction {
    from: string; // participant id
    to: string; // participant id
    amount: number; // in cents
}

// Balances: positive means they are owed money, negative means they owe money
export function simplifyDebts(balances: Record<string, number>): Transaction[] {
    const debtors: { id: string; amount: number }[] = [];
    const creditors: { id: string; amount: number }[] = [];

    for (const [id, balance] of Object.entries(balances)) {
        if (balance < -1) { // negative threshold due to tiny rounding variations
            debtors.push({ id, amount: Math.abs(balance) });
        } else if (balance > 1) {
            creditors.push({ id, amount: balance });
        }
    }

    // Sort largest debtors and largest creditors to match them
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions: Transaction[] = [];

    let i = 0; // index for debtors
    let j = 0; // index for creditors

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        const settledAmount = Math.min(debtor.amount, creditor.amount);

        // Only record transactions rounded to the nearest cent (1 unit)
        if (Math.round(settledAmount) > 0) {
            transactions.push({
                from: debtor.id,
                to: creditor.id,
                amount: Math.round(settledAmount)
            });
        }

        debtor.amount -= settledAmount;
        creditor.amount -= settledAmount;

        // Move pointers if settled within a 1-cent boundary
        if (debtor.amount < 1) {
            i++;
        }
        if (creditor.amount < 1) {
            j++;
        }
    }

    return transactions;
}
