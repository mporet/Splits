"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExpenseGroup } from "@prisma/client";
import { formatCurrencyDisplayName } from "@/lib/currencyFormat";

type GroupWithCount = ExpenseGroup & { _count: { participants: number; expenses: number } };

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [groups, setGroups] = useState<GroupWithCount[]>([]);
    const [loading, setLoading] = useState(true);

    // Create Group Form
    const [isCreating, setIsCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupPasscode, setNewGroupPasscode] = useState("");
    const [newGroupCurrency, setNewGroupCurrency] = useState("USD");
    const [newGroupExpenseCurrency, setNewGroupExpenseCurrency] = useState("USD");
    const [participantsText, setParticipantsText] = useState("");
    const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            fetchGroups();
            fetchCurrencies();
        }
    }, [status, router]);

    const fetchCurrencies = async () => {
        try {
            const res = await fetch("https://open.er-api.com/v6/latest/USD");
            if (res.ok) {
                const data = await res.json();
                if (data && data.rates) {
                    setAvailableCurrencies(Object.keys(data.rates).sort());
                }
            }
        } catch (e) {
            console.error("Failed to fetch currencies", e);
            setAvailableCurrencies(["USD", "EUR", "GBP", "CAD", "AUD", "JPY"]);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch("/api/groups");
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName || !newGroupPasscode || !participantsText) return;

        const participantsList = participantsText.split(',').map(p => p.trim()).filter(Boolean);

        // Add admin as a participant inherently by default? User can type themselves.
        try {
            const res = await fetch("/api/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newGroupName,
                    passcode: newGroupPasscode,
                    finalCurrency: newGroupCurrency,
                    defaultExpenseCurrency: newGroupExpenseCurrency,
                    participants: participantsList
                })
            });

            if (res.ok) {
                setIsCreating(false);
                setNewGroupName("");
                setNewGroupPasscode("");
                setParticipantsText("");
                setNewGroupCurrency("USD");
                setNewGroupExpenseCurrency("USD");
                fetchGroups();
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (status === "loading" || loading) return <div className="container mt-4 text-center">Loading...</div>;

    return (
        <div className="container">
            <div className="header">
                <div>
                    <h1 className="title">Admin Dashboard</h1>
                    <p className="subtitle">Manage your expense splitting groups</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsCreating(!isCreating)}>
                    {isCreating ? "Cancel" : "+ Create New Group"}
                </button>
            </div>

            {isCreating && (
                <div className="glass-card mb-4" style={{ border: "1px solid var(--primary)" }}>
                    <h3 style={{ marginBottom: "1.5rem", fontSize: "1.25rem" }}>Create New Group</h3>
                    <form onSubmit={handleCreateGroup}>
                        <div className="input-group">
                            <label className="input-label">Group Name</label>
                            <input type="text" className="input-field" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required placeholder="e.g. NYC Weekend Trip" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Passcode (For participants to join)</label>
                            <input type="text" className="input-field" value={newGroupPasscode} onChange={(e) => setNewGroupPasscode(e.target.value)} required placeholder="e.g. pizza123" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Default Expense Currency</label>
                            <select className="input-field" value={newGroupExpenseCurrency} onChange={(e) => setNewGroupExpenseCurrency(e.target.value)}>
                                {availableCurrencies.map(c => <option key={c} value={c}>{formatCurrencyDisplayName(c)}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Settlement Currency (Final amount owed)</label>
                            <select className="input-field" value={newGroupCurrency} onChange={(e) => setNewGroupCurrency(e.target.value)}>
                                {availableCurrencies.map(c => <option key={c} value={c}>{formatCurrencyDisplayName(c)}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Participants (Comma separated, including yourself if applicable)</label>
                            <input type="text" className="input-field" value={participantsText} onChange={(e) => setParticipantsText(e.target.value)} required placeholder="e.g. Alice, Bob, Charlie" />
                        </div>
                        <button type="submit" className="btn btn-primary">Create Group</button>
                    </form>
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                {groups.map(group => (
                    <Link href={`/group/${group.id}`} key={group.id}>
                        <div className="glass-card" style={{ cursor: "pointer", height: "100%", display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", margin: 0 }}>{group.name}</h3>
                                {group.isClosed && <span style={{ fontSize: "0.75rem", background: "var(--danger)", padding: "0.2rem 0.5rem", borderRadius: "12px", color: "white" }}>CLOSED</span>}
                            </div>
                            <p className="text-muted" style={{ fontSize: "0.9rem", flexGrow: 1 }}>
                                Passcode: <strong>{group.passcode}</strong>
                            </p>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--card-border)", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                <span>{group._count.participants} Participants</span>
                                <span>{group._count.expenses} Expenses</span>
                            </div>
                        </div>
                    </Link>
                ))}

                {groups.length === 0 && !isCreating && (
                    <div className="glass-card flex items-center justify-center flex-col" style={{ gridColumn: "1/-1", padding: "4rem 2rem" }}>
                        <p className="text-muted mb-4 text-center">You haven't created any groups yet.</p>
                        <button className="btn btn-primary" onClick={() => setIsCreating(true)}>Create Your First Group</button>
                    </div>
                )}
            </div>
        </div>
    );
}
