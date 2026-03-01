"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExpenseGroup, GroupParticipant, Expense, ExpensePayer, ExpenseSplit } from "@prisma/client";

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

    useEffect(() => {
        fetchGroup();
        fetchSavedGroups();
    }, [id]);

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

    return (
        <div className="container">
            <div className="header mb-4" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <h1 className="title">{group.name}</h1>
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
                    </div>
                    <p className="subtitle">Group Details & Expenses</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Quick Switch Dropdown */}
                    <div style={{ position: "relative" }}>
                        <select
                            className="input-field"
                            style={{ padding: "0.5rem", height: "auto", cursor: "pointer", background: "var(--card-bg)" }}
                            onChange={(e) => {
                                if (e.target.value) {
                                    router.push(`/group/${e.target.value}`);
                                }
                            }}
                            value=""
                        >
                            <option value="" disabled>Switch Group...</option>
                            {savedGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                            <option value="/">View All Saved Groups</option>
                        </select>
                    </div>

                    {group.isClosed ? (
                        <>
                            <Link href={`/group/${id}/settlement`} className="btn btn-secondary" style={{ background: "var(--secondary)", color: "white", border: "none" }}>
                                View Settlement Report
                            </Link>
                            {isAdmin && (
                                <button onClick={reopenGroup} className="btn btn-primary" style={{ border: "none" }}>
                                    Reopen Group
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <Link href={`/group/${id}/expenses/new`} className="btn btn-primary">
                                + Add Expense
                            </Link>
                            {isAdmin && (
                                <button onClick={closeGroup} className="btn btn-danger">
                                    Close & Settle Up
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {group.isClosed && (
                <div className="glass-card mb-4" style={{ textAlign: "center", border: "1px solid var(--secondary)", background: "rgba(16, 185, 129, 0.1)" }}>
                    <h3 style={{ color: "var(--secondary)" }}>This group is closed.</h3>
                    <p className="text-muted text-sm pb-2">All expenses have been finalized.</p>
                </div>
            )}

            {/* Participants Collapsible Menu */}
            <div className="glass-card mb-4">
                <details>
                    <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "1.1rem", outline: "none" }}>
                        👥 View Participants ({group.participants.length})
                    </summary>
                    <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem", borderTop: "1px solid var(--card-border)", paddingTop: "0.5rem" }}>
                        {group.participants.map(p => (
                            <li key={p.id} style={{ padding: "0.5rem 0", color: "var(--foreground)" }}>
                                👤 {p.name}
                            </li>
                        ))}
                    </ul>
                </details>
            </div>

            {/* Expenses List */}
            <div>
                <h3 style={{ marginBottom: "1rem" }}>Expenses</h3>
                {group.expenses.length === 0 ? (
                    <div className="glass-card text-center text-muted">
                        No expenses yet. Add one to get started!
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {group.expenses.map((expense: ExpenseExtended) => (
                            <div key={expense.id} className="glass-card" style={{ padding: "1.5rem" }}>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{expense.description}</h4>
                                    <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--primary)" }}>
                                        {expense.currency} {(expense.amount / 100).toFixed(2)}
                                    </span>
                                </div>

                                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                    <p>
                                        <strong>Paid by:</strong> {expense.payers.map((p: any) => `${p.participant.name} (${expense.currency} ${(p.amountPaid / 100).toFixed(2)})`).join(", ")}
                                    </p>
                                    <p className="mt-1">
                                        <strong>Split between:</strong> {expense.splits.map((s: any) => s.participant.name).join(", ")}
                                    </p>
                                </div>

                                {isAdmin && !group.isClosed && (
                                    <div style={{ marginTop: "1rem", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                                        <Link href={`/group/${id}/expenses/${expense.id}/edit`} className="btn btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Edit</Link>
                                        <button onClick={() => deleteExpense(expense.id)} className="btn btn-danger" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Delete</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
