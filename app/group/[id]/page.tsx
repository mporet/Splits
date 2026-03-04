"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExpenseGroup, GroupParticipant, Expense, ExpensePayer, ExpenseSplit } from "@prisma/client";
import { Transaction } from "@/lib/settlement";

type ExpenseExtended = Expense & {
    payers: (ExpensePayer & { participant: GroupParticipant })[];
    splits: (ExpenseSplit & { participant: GroupParticipant })[];
};

type GroupData = ExpenseGroup & {
    participants: GroupParticipant[];
    expenses: ExpenseExtended[];
};

export default function GroupPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [group, setGroup] = useState<GroupData | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savedGroups, setSavedGroups] = useState<{ id: string, name: string }[]>([]);

    const [activeTab, setActiveTab] = useState<"expenses" | "summary" | "ledgers" | "debts">("expenses");
    const [debtToMarkPaid, setDebtToMarkPaid] = useState<Transaction | null>(null);

    const markDebtAsPaid = async (debtId: string, isPaid: boolean) => {
        try {
            const res = await fetch(`/api/groups/${id}/settlement/${debtId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPaid })
            });
            if (res.ok) {
                fetchSettlement(); // Refresh UI
            }
        } catch (e) {
            console.error("Failed to mark debt", e);
        }
    };
    const [settlementData, setSettlementData] = useState<{
        rates: Record<string, number>;
        totalSpendByCurrency: Record<string, number>;
        grandTotalSpendBase: number;
        perPersonLedger: Record<string, any[]>;
        balances: Record<string, number>;
        transactions: Transaction[];
    } | null>(null);

    useEffect(() => {
        fetchGroup();
        fetchSavedGroups();
        fetchSettlement();
    }, [id]);

    const fetchSettlement = async () => {
        try {
            const res = await fetch(`/api/groups/${id}/settlement`);
            if (res.ok) {
                const data = await res.json();
                setSettlementData(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchGroup = async () => {
        try {
            const res = await fetch(`/api/groups/${id}`);
            if (res.ok) {
                const data = await res.json();
                setGroup(data.group);
                setIsAdmin(data.isAdmin);
            } else {
                if (res.status === 401) {
                    router.push("/");
                } else {
                    setError("Failed to load group");
                }
            }
        } catch (e) {
            setError("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const fetchSavedGroups = async () => {
        try {
            const res = await fetch("/api/groups/saved");
            if (res.ok) {
                const data = await res.json();
                setSavedGroups(data.groups || []);
            }
        } catch (err) {
            console.error("Failed to load saved groups", err);
        }
    };

    const closeGroup = async () => {
        if (!confirm("Are you sure you want to close this group and generate the settlement report? No more expenses can be added.")) return;

        try {
            const res = await fetch(`/api/groups/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isClosed: true })
            });
            if (res.ok) {
                fetchGroup();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const reopenGroup = async () => {
        if (!confirm("Are you sure you want to reopen this group? Participants will be able to add expenses again.")) return;

        try {
            const res = await fetch(`/api/groups/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isClosed: false })
            });
            if (res.ok) {
                fetchGroup();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const deleteExpense = async (expenseId: string) => {
        if (!confirm("Delete this expense?")) return;
        try {
            const res = await fetch(`/api/groups/${id}/expenses?expenseId=${expenseId}`, {
                method: "DELETE"
            });
            if (res.ok) fetchGroup();
        } catch (e) {
            console.error(e);
        }
    };


    if (loading) return <div className="container mt-4 text-center">Loading...</div>;
    if (error || !group) return <div className="container mt-4 text-center text-danger">{error}</div>;

    const { rates = {} as Record<string, number>, totalSpendByCurrency = {} as Record<string, number>, grandTotalSpendBase = 0, perPersonLedger = {} as Record<string, any>, balances = {} as Record<string, number>, transactions = [] as Transaction[] } = settlementData || {};
    const baseCurrency = group.finalCurrency || "USD";

    const getParticipantName = (participantId: string) => {
        return group.participants.find((p: any) => p.id === participantId)?.name || "Unknown";
    };

    const getVenmoUsername = (participantId: string) => {
        return group.participants.find((p: any) => p.id === participantId)?.venmoUsername || null;
    };

    return (
        <div className="container">
            <div className="header mb-4" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <h1 className="title">{group.name}</h1>
                    </div>
                    <p className="subtitle mb-2">Group Details & Expenses</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                        {isAdmin && (
                            <Link href={`/group/${id}/edit`} className="btn btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", height: "fit-content" }}>
                                ⚙️ Edit
                            </Link>
                        )}
                        <button
                            className="btn btn-secondary"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", height: "fit-content", background: "var(--primary)", color: "white", border: "none" }}
                            onClick={() => {
                                const url = `${window.location.origin}/?groupId=${group.id}`;
                                navigator.clipboard.writeText(url);
                                alert("Link copied to clipboard!");
                            }}
                        >
                            🔗 Share Group
                        </button>
                        {group.isClosed ? (
                            <>
                                {isAdmin && (
                                    <button onClick={reopenGroup} className="btn btn-primary" style={{ border: "none", padding: "0.3rem 0.6rem", fontSize: "0.8rem", height: "fit-content" }}>
                                        Reopen Group
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                {isAdmin && (
                                    <button onClick={closeGroup} className="btn btn-danger" style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", height: "fit-content" }}>
                                        Close & Settle Up
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Participants Collapsible Menu */}
            <div className="glass-card mb-4" style={{ padding: "0.5rem 1rem" }}>
                <details>
                    <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "0.95rem", outline: "none", color: "var(--primary)" }}>
                        👥 View Participants ({group.participants.length})
                    </summary>
                    <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem", borderTop: "1px solid var(--card-border)", paddingTop: "0.5rem" }}>
                        {group.participants.map((p: any) => (
                            <li key={p.id} style={{ padding: "0.25rem 0", color: "var(--foreground)", fontSize: "0.9rem" }}>
                                👤 {p.name}
                            </li>
                        ))}
                    </ul>
                </details>
            </div>


            {/* Navigation Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
                <button
                    onClick={() => setActiveTab("expenses")}
                    style={{
                        flex: "1 1 auto", minWidth: "100px", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
                        background: activeTab === "expenses" ? "var(--primary)" : "var(--card-bg)",
                        color: activeTab === "expenses" ? "white" : "var(--foreground)",
                        border: activeTab === "expenses" ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                        borderRadius: "12px", padding: "0.75rem", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s"
                    }}
                >
                    <span style={{ fontSize: "1.5rem" }}>🧾</span>
                    <span style={{ fontSize: "0.85rem", textAlign: "center" }}>Expenses</span>
                </button>
                <button
                    onClick={() => setActiveTab("summary")}
                    style={{
                        flex: "1 1 auto", minWidth: "100px", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
                        background: activeTab === "summary" ? "var(--primary)" : "var(--card-bg)",
                        color: activeTab === "summary" ? "white" : "var(--foreground)",
                        border: activeTab === "summary" ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                        borderRadius: "12px", padding: "0.75rem", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s"
                    }}
                >
                    <span style={{ fontSize: "1.5rem" }}>📊</span>
                    <span style={{ fontSize: "0.85rem", textAlign: "center" }}>Total Spend</span>
                </button>
                <button
                    onClick={() => setActiveTab("ledgers")}
                    style={{
                        flex: "1 1 auto", minWidth: "100px", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
                        background: activeTab === "ledgers" ? "var(--primary)" : "var(--card-bg)",
                        color: activeTab === "ledgers" ? "white" : "var(--foreground)",
                        border: activeTab === "ledgers" ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                        borderRadius: "12px", padding: "0.75rem", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s"
                    }}
                >
                    <span style={{ fontSize: "1.5rem" }}>📒</span>
                    <span style={{ fontSize: "0.85rem", textAlign: "center" }}>Ledgers</span>
                </button>
                {group.isClosed && (
                    <button
                        onClick={() => setActiveTab("debts")}
                        style={{
                            flex: "1 1 auto", minWidth: "100px", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
                            background: activeTab === "debts" ? "var(--primary)" : "var(--card-bg)",
                            color: activeTab === "debts" ? "white" : "var(--foreground)",
                            border: activeTab === "debts" ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                            borderRadius: "12px", padding: "0.75rem", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s"
                        }}
                    >
                        <span style={{ fontSize: "1.5rem" }}>🤝</span>
                        <span style={{ fontSize: "0.85rem", textAlign: "center" }}>Settlement</span>
                    </button>
                )}
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

                                                const isPaid = t.isPaid;
                                                const textColor = isPaid ? "var(--secondary)" : "var(--foreground)";

                                                return (
                                                    <div key={idx} className="flex justify-between items-center" style={{ paddingBottom: "1rem", borderBottom: idx < payeeTransactions.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                                                        <div style={{ fontSize: "1.1rem" }}>
                                                            <strong style={{ textDecoration: isPaid ? 'line-through' : 'none', color: isPaid ? "var(--text-muted)" : "inherit" }}>{payerName}</strong> {isPaid ? <span style={{ color: "var(--secondary)", fontWeight: "bold" }}>paid</span> : "owes"}
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: textColor, textDecoration: isPaid ? 'line-through' : 'none' }}>
                                                                {baseCurrency} {amountDisplay}
                                                            </span>

                                                            {!isPaid && (
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", height: "auto" }}
                                                                    onClick={() => setDebtToMarkPaid(t)}
                                                                >
                                                                    Mark Paid
                                                                </button>
                                                            )}

                                                            {toVenmo && !isPaid && (
                                                                <button
                                                                    className="btn"
                                                                    style={{ background: "#008CFF", color: "white", fontSize: "0.85rem", padding: "0.4rem 0.8rem", height: "auto" }}
                                                                    onClick={() => {
                                                                        if (confirm("Would you like to mark this debt as paid before transferring?")) {
                                                                            if (t.id) markDebtAsPaid(t.id, true);
                                                                        }
                                                                        window.open(`venmo://paycharge?txn=pay&recipients=${encodeURIComponent(toVenmo)}&amount=${amountDisplay}&note=${encodeURIComponent(`Expense Split for ${group.name}`)}`, "_blank");
                                                                    }}
                                                                >
                                                                    Pay
                                                                </button>
                                                            )}

                                                            {isPaid && isAdmin && (
                                                                <button
                                                                    className="btn btn-danger"
                                                                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", height: "auto" }}
                                                                    onClick={() => {
                                                                        if (confirm("Unmark this debt as paid?")) {
                                                                            if (t.id) markDebtAsPaid(t.id, false);
                                                                        }
                                                                    }}
                                                                >
                                                                    Unmark Paid
                                                                </button>
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

            {activeTab === "expenses" && (
                <div style={{ animation: "fadeIn 0.3s ease" }}>
                    {group.isClosed && (
                        <div className="glass-card mb-4" style={{ textAlign: "center", border: "1px solid var(--secondary)", background: "rgba(16, 185, 129, 0.1)" }}>
                            <h3 style={{ color: "var(--secondary)" }}>This group is closed.</h3>
                            <p className="text-muted text-sm pb-2">All expenses have been finalized.</p>
                        </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0 }}>Expenses</h3>
                        {!group.isClosed && (
                            <Link href={`/group/${id}/expenses/new`} className="btn btn-primary">
                                + Add Expense
                            </Link>
                        )}
                    </div>
                    {group.expenses.length === 0 ? (
                        <div className="glass-card text-center text-muted">
                            No expenses yet. Add one to get started!
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {group.expenses.map((expense: ExpenseExtended) => {
                                const isNotEqualSplit = expense.splits.some((s: any) => s.splitType !== "EQUAL");

                                return (
                                    <details key={expense.id} className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                                        <summary style={{ padding: "1.5rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", outline: "none", userSelect: "none" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s" }} className="expand-icon">
                                                        <polyline points="6 9 12 15 18 9"></polyline>
                                                    </svg>
                                                </span>
                                                <h4 style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0 }}>{expense.description}</h4>
                                            </div>
                                            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--primary)" }}>
                                                {expense.currency} {(expense.amount / 100).toFixed(2)}
                                            </span>
                                        </summary>

                                        <div style={{ padding: "0 1.5rem 1.5rem 1.5rem", fontSize: "0.85rem", color: "var(--text-muted)", borderTop: "1px solid var(--card-border)", paddingTop: "1rem" }}>
                                            <p>
                                                <strong>Paid by:</strong> {expense.payers.map((p: any) => `${p.participant.name} (${expense.currency} ${(p.amountPaid / 100).toFixed(2)})`).join(", ")}
                                            </p>
                                            <p className="mt-1">
                                                <strong>Split between:</strong> {
                                                    expense.splits.length === group.participants.length && !isNotEqualSplit
                                                        ? `All (${group.participants.length})`
                                                        : isNotEqualSplit
                                                            ? expense.splits.map((s: any) => `${s.participant.name} (${expense.currency} ${(s.amountSplit / 100).toFixed(2)})`).join(", ")
                                                            : expense.splits.map((s: any) => s.participant.name).join(", ")
                                                }
                                            </p>

                                            {isAdmin && !group.isClosed && (
                                                <div style={{ marginTop: "1rem", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                                                    <Link href={`/group/${id}/expenses/${expense.id}/edit`} className="btn btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Edit</Link>
                                                    <button onClick={() => deleteExpense(expense.id)} className="btn btn-danger" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Delete</button>
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {debtToMarkPaid && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
                    <div className="glass-card" style={{ maxWidth: "400px", width: "100%", padding: "2rem" }}>
                        <h3 className="mb-4">Confirm Payment</h3>
                        <p className="mb-4 text-muted">Are you sure you want to mark this debt as paid?</p>
                        <p className="mb-4 text-center">
                            <strong>{getParticipantName(debtToMarkPaid.from)}</strong> pays <strong>{getParticipantName(debtToMarkPaid.to)}</strong><br />
                            <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--foreground)" }}>{baseCurrency} {(debtToMarkPaid.amount / 100).toFixed(2)}</span>
                        </p>
                        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                            <button className="btn btn-secondary" onClick={() => setDebtToMarkPaid(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => {
                                if (debtToMarkPaid.id) {
                                    markDebtAsPaid(debtToMarkPaid.id, true);
                                }
                                setDebtToMarkPaid(null);
                            }}>Confirm Paid</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
