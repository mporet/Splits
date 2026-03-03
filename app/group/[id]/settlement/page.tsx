"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { simplifyDebts, Transaction } from "@/lib/settlement";

export default function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;

    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState<Record<string, number>>({});
    const [totalSpendByCurrency, setTotalSpendByCurrency] = useState<Record<string, number>>({});
    const [grandTotalSpendBase, setGrandTotalSpendBase] = useState(0);
    const [perPersonLedger, setPerPersonLedger] = useState<Record<string, any>>({});
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // UI State
    const [activeTab, setActiveTab] = useState<"summary" | "debts" | "ledgers">("summary");

    useEffect(() => {
        async function loadData() {
            try {
                // Fetch group data via API
                const res = await fetch(`/api/groups/${id}/settlement`);
                if (!res.ok) {
                    if (res.status === 404) return notFound();
                    throw new Error("Failed to load group");
                }
                const data = await res.json();

                setGroup(data.group);
                setRates(data.rates);
                setTotalSpendByCurrency(data.totalSpendByCurrency);
                setGrandTotalSpendBase(data.grandTotalSpendBase);
                setPerPersonLedger(data.perPersonLedger);
                setBalances(data.balances);
                setTransactions(data.transactions);

                // If group is open, default to summary tab because debts won't be available
                if (!data.group.isClosed) {
                    setActiveTab("summary");
                } else {
                    setActiveTab("debts"); // default to debts if closed
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    if (loading) {
        return <div className="container mt-8 text-center"><div className="loader mx-auto" style={{ width: "3rem", height: "3rem", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div></div>;
    }

    if (!group) return notFound();
    const baseCurrency = group.finalCurrency || "USD";

    const getParticipantName = (participantId: string) => {
        return group.participants.find((p: any) => p.id === participantId)?.name || "Unknown";
    };

    const getVenmoUsername = (participantId: string) => {
        return group.participants.find((p: any) => p.id === participantId)?.venmoUsername || null;
    };

    return (
        <div className="container" style={{ paddingBottom: "4rem" }}>
            <div className="header mb-4">
                <div>
                    <h1 className="title">Settlement Report</h1>
                    <p className="subtitle">{group.name} - {group.isClosed ? `Final Debts (${baseCurrency})` : `Current Spend Review (${baseCurrency})`}</p>
                </div>
                <Link href={`/group/${id}`} className="btn btn-secondary">Back to Group</Link>
            </div>

            {!group.isClosed && (
                <div className="glass-card mb-4" style={{ textAlign: "center", border: "1px solid var(--destructive)", background: "rgba(239, 68, 68, 0.1)" }}>
                    <h3 style={{ color: "var(--destructive)", marginBottom: "0.5rem" }}>⚠️ Group is still open</h3>
                    <p className="text-muted text-sm pb-2">Simplified payment plans will be generated once an admin closes the group. You can still review totals and individual ledgers below.</p>
                </div>
            )}

            {group.isClosed && (
                <div className="glass-card mb-4" style={{ textAlign: "center", border: "1px solid var(--secondary)", background: "rgba(16, 185, 129, 0.1)" }}>
                    <h3 style={{ color: "var(--secondary)", marginBottom: "0.5rem" }}>All Settled Up!</h3>
                    <p className="text-muted text-sm pb-2">Debts have been simplified to the minimum number of transactions.</p>
                </div>
            )}

            {/* Navigation Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--card-border)", overflowX: "auto" }}>
                {group.isClosed && (
                    <button
                        onClick={() => setActiveTab("debts")}
                        style={{
                            background: activeTab === "debts" ? "rgba(255,255,255,0.1)" : "transparent",
                            color: activeTab === "debts" ? "var(--primary)" : "var(--text-muted)",
                            border: "none", borderBottom: activeTab === "debts" ? "2px solid var(--primary)" : "2px solid transparent",
                            padding: "0.75rem 1.5rem", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s"
                        }}
                    >
                        Who Owes Whom
                    </button>
                )}
                <button
                    onClick={() => setActiveTab("summary")}
                    style={{
                        background: activeTab === "summary" ? "rgba(255,255,255,0.1)" : "transparent",
                        color: activeTab === "summary" ? "var(--primary)" : "var(--text-muted)",
                        border: "none", borderBottom: activeTab === "summary" ? "2px solid var(--primary)" : "2px solid transparent",
                        padding: "0.75rem 1.5rem", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s"
                    }}
                >
                    Total Group Spend
                </button>
                <button
                    onClick={() => setActiveTab("ledgers")}
                    style={{
                        background: activeTab === "ledgers" ? "rgba(255,255,255,0.1)" : "transparent",
                        color: activeTab === "ledgers" ? "var(--primary)" : "var(--text-muted)",
                        border: "none", borderBottom: activeTab === "ledgers" ? "2px solid var(--primary)" : "2px solid transparent",
                        padding: "0.75rem 1.5rem", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s"
                    }}
                >
                    Individual Ledgers
                </button>
            </div>

            {/* Tab Contents */}

            {activeTab === "summary" && (
                <div className="glass-card mb-4" style={{ display: "flex", flexDirection: "column", gap: "1rem", animation: "fadeIn 0.3s ease" }}>
                    <h3 style={{ margin: 0, borderBottom: "1px solid var(--card-border)", paddingBottom: "0.5rem" }}>Total Group Spend</h3>

                    {(() => {
                        const uniqueCurrencies = Array.from(new Set(group.expenses.map((e: any) => e.currency))).filter(c => c !== baseCurrency);
                        if (uniqueCurrencies.length > 0) {
                            return (
                                <div style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid var(--primary)", borderRadius: "8px", padding: "0.75rem", fontSize: "0.9rem" }}>
                                    <div style={{ color: "var(--foreground)", fontWeight: "bold", marginBottom: "0.25rem" }}>💱 Exchange Rates Applied</div>
                                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>Expenses were converted to {baseCurrency} using today's rates.</div>
                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
                                        {uniqueCurrencies.map((currency) => {
                                            const currCode = currency as string;
                                            const rate = (rates[baseCurrency] || 1) / (rates[currCode] || 1);
                                            return (
                                                <span key={currCode} style={{ background: "rgba(255,255,255,0.1)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                                                    1 {currCode} = {rate.toFixed(4)} {baseCurrency}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {Object.entries(totalSpendByCurrency).map(([currency, amount]) => (
                            <div key={currency} className="flex justify-between items-center">
                                <span>Total in {currency}</span>
                                <span style={{ fontWeight: "bold" }}>{(amount / 100).toFixed(2)}</span>
                            </div>
                        ))}
                        {Object.keys(totalSpendByCurrency).length > 0 && (
                            <div className="flex justify-between" style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed var(--card-border)" }}>
                                <span style={{ color: "var(--primary)" }}>Grand Total ({baseCurrency} eqv.)</span>
                                <span style={{ fontWeight: "bold", fontSize: "1.1rem", color: "var(--primary)" }}>{(grandTotalSpendBase / 100).toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "debts" && group.isClosed && (
                <div className="glass-card" style={{ animation: "fadeIn 0.3s ease" }}>
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
            )}

            {activeTab === "ledgers" && (
                <div className="glass-card mb-4" style={{ animation: "fadeIn 0.3s ease" }}>
                    <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.5rem" }}>Individual Ledgers</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {group.participants.map((p: any) => {
                            const ledger = perPersonLedger[p.id] || [];
                            const netBalance = balances[p.id] || 0;
                            if (ledger.length === 0) return null;

                            return (
                                <details key={p.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--card-border)" }}>
                                    <summary style={{ padding: "1rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", userSelect: "none" }}>
                                        <span>{p.name}</span>
                                        <span style={{
                                            color: netBalance > 0 ? "var(--secondary)" : netBalance < 0 ? "var(--destructive)" : "inherit"
                                        }}>
                                            {netBalance > 0 ? `Lent ${baseCurrency} ${(netBalance / 100).toFixed(2)}` : netBalance < 0 ? `Owes ${baseCurrency} ${(Math.abs(netBalance) / 100).toFixed(2)}` : "Settled (0.00)"}
                                        </span>
                                    </summary>
                                    <div style={{ padding: "0 1rem 1rem 1rem", fontSize: "0.9rem" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                            {ledger.map((entry: any) => (
                                                <div key={entry.expenseId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.5rem" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                                                        <div>
                                                            <div style={{ fontWeight: "bold" }}>{entry.description}</div>
                                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{entry.originalCurrency} ${(entry.originalAmount / 100).toFixed(2)}</div>
                                                        </div>
                                                        <div style={{ textAlign: "right", fontWeight: "bold", color: entry.netConvert > 0 ? "var(--secondary)" : entry.netConvert < 0 ? "var(--destructive)" : "inherit" }}>
                                                            {entry.netConvert > 0 ? "+" : ""}{(entry.netConvert / 100).toFixed(2)} {baseCurrency}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                                                        <div style={{ color: entry.paidConvert > 0 ? "var(--secondary)" : "inherit" }}>
                                                            Paid: {entry.paidConvert > 0 ? `${baseCurrency} ${(entry.paidConvert / 100).toFixed(2)}` : "-"}
                                                        </div>
                                                        <div style={{ color: entry.owedConvert > 0 ? "var(--destructive)" : "inherit" }}>
                                                            Share: {entry.owedConvert > 0 ? `${baseCurrency} ${(entry.owedConvert / 100).toFixed(2)}` : "-"}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", paddingTop: "0.5rem", borderTop: "1px solid var(--card-border)" }}>
                                                <div>Total Net</div>
                                                <div style={{ color: netBalance > 0 ? "var(--secondary)" : netBalance < 0 ? "var(--destructive)" : "inherit" }}>
                                                    {baseCurrency} {(netBalance / 100).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-4" style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Total Group Expenses: {group.expenses.length} records.
            </div>
        </div>
    );
}
