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
        if (balance < 0) {
            debtors.push({ id, amount: Math.abs(balance) });
        } else if (balance > 0) {
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

        // Only record transactions of at least 1 cent
        if (settledAmount > 0) {
            transactions.push({
                from: debtor.id,
                to: creditor.id,
                amount: settledAmount
            });
        }

        debtor.amount -= settledAmount;
        creditor.amount -= settledAmount;

        // Move pointers if settled exactly
        if (debtor.amount === 0) {
            i++;
        }
        if (creditor.amount === 0) {
            j++;
        }
    }

    return transactions;
}
