import { prisma } from "@/lib/db";
import { convertCurrency } from "@/lib/exchangeRates";
import { simplifyDebts, Transaction } from "@/lib/settlement";
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
    group.participants.forEach(p => { balances[p.id] = 0; });

    for (const expense of group.expenses) {
        // Determine the amount to add/subtract in the final currency
        for (const payer of expense.payers) {
            const convertedPaid = await convertCurrency(payer.amountPaid, expense.currency, baseCurrency);
            balances[payer.participantId] += convertedPaid; // Payer gets positive balance
        }
        for (const split of expense.splits) {
            const convertedSplit = await convertCurrency(split.amountSplit, expense.currency, baseCurrency);
            balances[split.participantId] -= convertedSplit; // Splitter gets negative balance (owes)
        }
    }

    // Generate perfect simplified transactions
    const transactions = simplifyDebts(balances);

    const getParticipantName = (participantId: string) => {
        return group.participants.find(p => p.id === participantId)?.name || "Unknown";
    };

    const generatePaymentLink = (fromName: string, toName: string, amount: number) => {
        const amountFloat = (amount / 100).toFixed(2);
        const note = `Expense Split for ${group.name}`;
        // Simple deep links (Venmo / PayPal / CashApp)
        // Here we just provide standard app links
        return `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(toName)}&amount=${amountFloat}&note=${encodeURIComponent(note)}`;
    };

    const totalExpenses = group.expenses.reduce((sum, e) => sum + e.amount, 0); // note this sum is mixed currency slightly inaccurate to display but okay for debug

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

            <div className="glass-card">
                <h3 style={{ marginBottom: "1.5rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.5rem" }}>Who owes whom?</h3>

                {transactions.length === 0 ? (
                    <p className="text-center text-muted">No one owes anything! Everything is perfectly balanced.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {transactions.map((t, idx) => {
                            const fromName = getParticipantName(t.from);
                            const toName = getParticipantName(t.to);
                            const amountDisplay = (t.amount / 100).toFixed(2);

                            return (
                                <div key={idx} style={{ padding: "1.5rem", background: "rgba(15, 23, 42, 0.4)", borderRadius: "12px", border: "1px solid var(--card-border)" }}>
                                    <div className="flex justify-between items-center mb-4">
                                        <div style={{ fontSize: "1.1rem" }}>
                                            <strong>{fromName}</strong> owes <strong>{toName}</strong>
                                        </div>
                                        <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--primary)" }}>
                                            {baseCurrency} {amountDisplay}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {/* Payment Deep Links */}
                                        <a href={generatePaymentLink(fromName, toName, t.amount)} className="btn" style={{ background: "#008CFF", color: "white", flex: 1, fontSize: "0.85rem", padding: "0.5rem" }} target="_blank" rel="noreferrer">
                                            Pay with Venmo
                                        </a>
                                        <a href={`https://paypal.me/${encodeURIComponent(toName)}/${amountDisplay}${baseCurrency}`} className="btn" style={{ background: "#003087", color: "white", flex: 1, fontSize: "0.85rem", padding: "0.5rem" }} target="_blank" rel="noreferrer">
                                            Pay with PayPal
                                        </a>
                                        <a href={`https://cash.app/$${encodeURIComponent(toName)}/${amountDisplay}`} className="btn" style={{ background: "#00D632", color: "white", flex: 1, fontSize: "0.85rem", padding: "0.5rem" }} target="_blank" rel="noreferrer">
                                            Pay with CashApp
                                        </a>
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
