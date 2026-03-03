import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { convertCurrency, fetchExchangeRates } from "@/lib/exchangeRates";
import { simplifyDebts } from "@/lib/settlement";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const group = await prisma.expenseGroup.findUnique({
        where: { id },
        include: {
            participants: true,
            expenses: {
                include: { payers: true, splits: true }
            }
        }
    });

    if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const baseCurrency = group.finalCurrency || "USD";
    const rates = await fetchExchangeRates();

    // Track total spend
    const totalSpendByCurrency: Record<string, number> = {};
    let grandTotalSpendBase = 0;

    // Track individual ledgers
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

    // Calculate net balances
    const balances: Record<string, number> = {};
    group.participants.forEach((p: any) => {
        balances[p.id] = 0;
        perPersonLedger[p.id] = [];
    });

    for (const expense of group.expenses) {
        // Determine the total converted amount to guarantee exact zero-sum ledger
        const convertedTotal = await convertCurrency(expense.amount, expense.currency, baseCurrency);

        totalSpendByCurrency[expense.currency] = (totalSpendByCurrency[expense.currency] || 0) + expense.amount;
        grandTotalSpendBase += convertedTotal;

        const expenseLedgerMap = new Map<string, { paid: number, owed: number }>();

        // Distribute converted amount proportionally among payers
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
            balances[payer.participantId] += convertedPaid; // Payer gets positive balance

            const current = expenseLedgerMap.get(payer.participantId) || { paid: 0, owed: 0 };
            current.paid += convertedPaid;
            expenseLedgerMap.set(payer.participantId, current);
        }

        // Distribute converted amount proportionally among splits
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
            balances[split.participantId] -= convertedSplit; // Splitter gets negative balance (owes)

            const current = expenseLedgerMap.get(split.participantId) || { paid: 0, owed: 0 };
            current.owed += convertedSplit;
            expenseLedgerMap.set(split.participantId, current);
        }

        // Add to perPersonLedger
        for (const [participantId, data] of expenseLedgerMap.entries()) {
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

    // Generate perfect simplified transactions
    const transactions = simplifyDebts(balances);

    return NextResponse.json({
        group,
        rates,
        totalSpendByCurrency,
        grandTotalSpendBase,
        perPersonLedger,
        balances,
        transactions
    });
}
