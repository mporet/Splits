import { convertCurrency, fetchExchangeRates } from "@/lib/exchangeRates";
import { simplifyDebts } from "@/lib/settlement";
import { ExpenseGroup, Expense, ExpensePayer, ExpenseSplit, GroupParticipant } from "@prisma/client";

type ExpenseExtended = Expense & {
    payers: ExpensePayer[];
    splits: ExpenseSplit[];
};

type GroupData = ExpenseGroup & {
    participants: GroupParticipant[];
    expenses: ExpenseExtended[];
};

export async function calculateSettlement(group: GroupData) {
    const baseCurrency = group.finalCurrency || "USD";
    const rates = await fetchExchangeRates();

    const totalSpendByCurrency: Record<string, number> = {};
    let grandTotalSpendBase = 0;

    interface LedgerEntry {
        expenseId: string;
        description: string;
        originalAmount: number;
        originalCurrency: string;
        convertedTotal: number;
        paidConvert: number;
        owedConvert: number;
        netConvert: number;
    }
    const perPersonLedger: Record<string, LedgerEntry[]> = {};

    const balances: Record<string, number> = {};
    group.participants.forEach((p) => {
        balances[p.id] = 0;
        perPersonLedger[p.id] = [];
    });

    for (const expense of group.expenses) {
        const convertedTotal = await convertCurrency(expense.amount, expense.currency, baseCurrency);

        totalSpendByCurrency[expense.currency] = (totalSpendByCurrency[expense.currency] || 0) + expense.amount;
        grandTotalSpendBase += convertedTotal;

        const expenseLedgerMap = new Map<string, { paid: number, owed: number }>();

        let sumConvertedPaid = 0;
        for (let i = 0; i < expense.payers.length; i++) {
            const payer = expense.payers[i];
            let convertedPaid = 0;
            if (i === expense.payers.length - 1) {
                convertedPaid = convertedTotal - sumConvertedPaid;
            } else {
                const ratio = expense.amount > 0 ? (payer.amountPaid / expense.amount) : 0;
                convertedPaid = Math.round(convertedTotal * ratio);
                sumConvertedPaid += convertedPaid;
            }
            balances[payer.participantId] += convertedPaid;

            const current = expenseLedgerMap.get(payer.participantId) || { paid: 0, owed: 0 };
            current.paid += convertedPaid;
            expenseLedgerMap.set(payer.participantId, current);
        }

        let sumConvertedSplit = 0;
        for (let i = 0; i < expense.splits.length; i++) {
            const split = expense.splits[i];
            let convertedSplit = 0;
            if (i === expense.splits.length - 1) {
                convertedSplit = convertedTotal - sumConvertedSplit;
            } else {
                const ratio = expense.amount > 0 ? (split.amountSplit / expense.amount) : 0;
                convertedSplit = Math.round(convertedTotal * ratio);
                sumConvertedSplit += convertedSplit;
            }
            balances[split.participantId] -= convertedSplit;

            const current = expenseLedgerMap.get(split.participantId) || { paid: 0, owed: 0 };
            current.owed += convertedSplit;
            expenseLedgerMap.set(split.participantId, current);
        }

        for (const [participantId, data] of Array.from(expenseLedgerMap.entries())) {
            perPersonLedger[participantId].push({
                expenseId: expense.id,
                description: expense.description,
                originalAmount: expense.amount,
                originalCurrency: expense.currency,
                convertedTotal,
                paidConvert: data.paid,
                owedConvert: data.owed,
                netConvert: data.paid - data.owed
            });
        }
    }

    const transactions = simplifyDebts(balances);

    return {
        rates,
        totalSpendByCurrency,
        grandTotalSpendBase,
        perPersonLedger,
        balances,
        transactions
    };
}
