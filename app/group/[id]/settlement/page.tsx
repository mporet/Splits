import { prisma } from "@/lib/db";
import { convertCurrency } from "@/lib/exchangeRates";
import { simplifyDebts } from "@/lib/settlement";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
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

    if (!group) return notFound();
    if (!group.isClosed) {
        return (
            <div className="container mt-4 text-center">
                <h2 className="title mb-4">Group is not closed yet</h2>
                <Link href={`/group/${id}`} className="btn btn-primary">Go back to group</Link>
            </div>
        );
    }

    const baseCurrency = group.finalCurrency || "USD";

    // Calculate net balances
    const balances: Record<string, number> = {};
    group.participants.forEach((p: any) => { balances[p.id] = 0; });

    for (const expense of group.expenses) {
        // Determine the total converted amount to guarantee exact zero-sum ledger
        const convertedTotal = await convertCurrency(expense.amount, expense.currency, baseCurrency);

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
        }
    }

    // Generate perfect simplified transactions
    const transactions = simplifyDebts(balances);

    const getParticipantName = (participantId: string) => {
        return group.participants.find((p: any) => p.id === participantId)?.name || "Unknown";
    };

    const getVenmoUsername = (participantId: string) => {
        return group.participants.find((p: any) => p.id === participantId)?.venmoUsername || null;
    };

    const totalExpenses = group.expenses.reduce((sum: any, e: any) => sum + e.amount, 0); // note this sum is mixed currency slightly inaccurate to display but okay for debug

    return (
        <div className="container">
            <div className="header mb-4">
                <div>
                    <h1 className="title">Settlement Report</h1>
                    <p className="subtitle">{group.name} - Final Debts ({baseCurrency})</p>
                </div>
                <Link href={`/group/${id}`} className="btn btn-secondary">Back to Group</Link>
            </div>

            <div className="glass-card mb-4" style={{ textAlign: "center", border: "1px solid var(--secondary)", background: "rgba(16, 185, 129, 0.1)" }}>
                <h3 style={{ color: "var(--secondary)", marginBottom: "0.5rem" }}>All Settled Up!</h3>
                <p className="text-muted text-sm pb-2">Debts have been simplified to the minimum number of transactions.</p>
            </div>

            {/* Exchange Rates Display */}
            {(() => {
                const uniqueCurrencies = Array.from(new Set(group.expenses.map((e: any) => e.currency))).filter(c => c !== baseCurrency);
                if (uniqueCurrencies.length > 0) {
                    return (
                        <div className="glass-card mb-4" style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid var(--primary)", textAlign: "center" }}>
                            <h4 style={{ color: "var(--foreground)", marginBottom: "0.5rem", fontSize: "1rem" }}>💱 Currency Conversions</h4>
                            <p className="text-muted text-sm" style={{ marginBottom: "0.5rem" }}>
                                Expenses not in {baseCurrency} were converted using today's exchange rates.
                            </p>
                            <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
                                {uniqueCurrencies.map((currency) => (
                                    <span key={currency as string} style={{ background: "rgba(255,255,255,0.1)", padding: "0.2rem 0.6rem", borderRadius: "4px" }}>
                                        {/* To render async data inline, we either need a sub-component or calculate upfront. For now, just indicating it was converted correctly. */}
                                        {currency as string} → {baseCurrency} conversions applied
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            <div className="glass-card">
                <h3 style={{ marginBottom: "1.5rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.5rem" }}>Who owes whom?</h3>

                {transactions.length === 0 ? (
                    <p className="text-center text-muted">No one owes anything! Everything is perfectly balanced.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        {Object.entries(
                            transactions.reduce((acc, t) => {
                                acc[t.to] = acc[t.to] || [];
                                acc[t.to].push(t);
                                return acc;
                            }, {} as Record<string, typeof transactions>)
                        ).map(([payeeId, payeeTransactions]) => {
                            const payeeName = getParticipantName(payeeId);
                            const toVenmo = getVenmoUsername(payeeId);

                            return (
                                <div key={payeeId} style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "12px", border: "1px solid var(--card-border)", overflow: "hidden" }}>
                                    <div style={{ padding: "1rem 1.5rem", background: "rgba(255, 255, 255, 0.05)", borderBottom: "1px solid var(--card-border)" }}>
                                        <h4 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "bold" }}>
                                            Payments to <span style={{ color: "var(--primary)" }}>{payeeName}</span>
                                        </h4>
                                    </div>

                                    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                                        {payeeTransactions.map((t, idx) => {
                                            const payerName = getParticipantName(t.from);
                                            const amountDisplay = (t.amount / 100).toFixed(2);

                                            return (
                                                <div key={idx} className="flex justify-between items-center" style={{ paddingBottom: "1rem", borderBottom: idx < payeeTransactions.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                                                    <div style={{ fontSize: "1.1rem" }}>
                                                        <strong>{payerName}</strong> owes
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                                        <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--foreground)" }}>
                                                            {baseCurrency} {amountDisplay}
                                                        </span>
                                                        {toVenmo && (
                                                            <a href={`venmo://paycharge?txn=pay&recipients=${encodeURIComponent(toVenmo)}&amount=${amountDisplay}&note=${encodeURIComponent(`Expense Split for ${group.name}`)}`} className="btn" style={{ background: "#008CFF", color: "white", fontSize: "0.85rem", padding: "0.4rem 0.8rem", height: "auto" }} target="_blank" rel="noreferrer">
                                                                Pay
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-4" style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Total Group Expenses: {group.expenses.length} records.
            </div>
        </div>
    );
}
