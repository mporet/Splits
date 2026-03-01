"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExpenseGroup, GroupParticipant } from "@prisma/client";
import { formatCurrencyDisplayName } from "@/lib/currencyFormat";

type Participant = { id: string; name: string };
type GroupData = ExpenseGroup & { id: string; name: string; defaultExpenseCurrency: string; finalCurrency: string };

export default function AddExpensePage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [description, setDescription] = useState("");
    const [amountInput, setAmountInput] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Payers state
    const [payerMode, setPayerMode] = useState<"EQUAL" | "EXACT">("EQUAL");
    const [selectedPayers, setSelectedPayers] = useState<Record<string, boolean>>({});
    const [exactPayments, setExactPayments] = useState<Record<string, string>>({});

    // Splits state
    const [splitMode, setSplitMode] = useState<"EQUAL" | "EXACT" | "PERCENTAGE">("EQUAL");
    const [selectedSplits, setSelectedSplits] = useState<Record<string, boolean>>({});
    const [exactSplits, setExactSplits] = useState<Record<string, string>>({});
    const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch(`/api/groups/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data.group && !data.group.isClosed) {
                    setParticipants(data.group.participants);
                    setCurrency(data.group.defaultExpenseCurrency || data.group.finalCurrency || "USD");

                    // Default selection: Everyone is selected for both paying and splitting initially
                    // Wait, defaulting 1st person as paying makes more sense, and everyone splitting.
                    const initialSplits: Record<string, boolean> = {};
                    data.group.participants.forEach((p: Participant) => {
                        initialSplits[p.id] = true;
                    });
                    setSelectedSplits(initialSplits);

                    if (data.group.participants.length > 0) {
                        setSelectedPayers({ [data.group.participants[0].id]: true });
                    }
                } else {
                    router.push(`/group/${id}`);
                }
            });

        // Fetch currencies
        fetch("https://open.er-api.com/v6/latest/USD")
            .then(res => res.json())
            .then(data => {
                if (data && data.rates) {
                    setAvailableCurrencies(Object.keys(data.rates).sort());
                }
            })
            .catch((e) => {
                console.error("Failed to fetch currencies", e);
                setAvailableCurrencies(["USD", "EUR", "GBP", "CAD", "AUD", "JPY"]);
            });
    }, [id, router]);

    const toggleSelection = (
        id: string,
        state: Record<string, boolean>,
        setState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    ) => {
        setState(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const calculateAmounts = () => {
        const amountCents = Math.round(parseFloat(amountInput) * 100);
        if (isNaN(amountCents) || amountCents <= 0) throw new Error("Please enter a valid amount.");

        // Payers
        const payers: any[] = [];
        const activePayers = Object.keys(selectedPayers).filter(pid => selectedPayers[pid]);

        if (activePayers.length === 0) throw new Error("At least one person must pay.");

        if (payerMode === "EQUAL") {
            const share = Math.floor(amountCents / activePayers.length);
            let remainder = amountCents % activePayers.length;
            activePayers.forEach(pid => {
                payers.push({ participantId: pid, amountPaid: share + (remainder > 0 ? 1 : 0) });
                remainder--;
            });
        } else {
            let sum = 0;
            activePayers.forEach(pid => {
                const val = Math.round(parseFloat(exactPayments[pid] || "0") * 100);
                payers.push({ participantId: pid, amountPaid: val });
                sum += val;
            });
            if (Math.abs(sum - amountCents) > 1) throw new Error("Exact payments must add up to the total.");
        }

        // Splits
        const splits: any[] = [];
        const activeSplits = Object.keys(selectedSplits).filter(pid => selectedSplits[pid]);

        if (activeSplits.length === 0) throw new Error("At least one person must be selected for the split.");

        if (splitMode === "EQUAL") {
            const share = Math.floor(amountCents / activeSplits.length);
            let remainder = amountCents % activeSplits.length;
            activeSplits.forEach(pid => {
                splits.push({ participantId: pid, amountSplit: share + (remainder > 0 ? 1 : 0), splitType: "EQUAL" });
                remainder--;
            });
        } else if (splitMode === "EXACT") {
            let sum = 0;
            activeSplits.forEach(pid => {
                const val = Math.round(parseFloat(exactSplits[pid] || "0") * 100);
                splits.push({ participantId: pid, amountSplit: val, splitType: "EXACT" });
                sum += val;
            });
            if (Math.abs(sum - amountCents) > 1) throw new Error("Exact splits must add up to the total.");
        } else if (splitMode === "PERCENTAGE") {
            let sumPercent = 0;
            let sumAmount = 0;
            activeSplits.forEach((pid, index) => {
                const pct = parseFloat(percentageSplits[pid] || "0");
                sumPercent += pct;

                // Handle rounding so it adds exactly to amountCents
                let valCents = Math.round(amountCents * (pct / 100));

                // Adjust last person if there are slight rounding differences
                if (index === activeSplits.length - 1) {
                    valCents = amountCents - sumAmount;
                }

                splits.push({ participantId: pid, amountSplit: valCents, splitType: "PERCENTAGE", percentage: pct });
                sumAmount += valCents;
            });
            if (Math.abs(sumPercent - 100) > 0.1) throw new Error("Percentages must add up to 100.");
        }

        return { amountCents, payers, splits };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            const { amountCents, payers, splits } = calculateAmounts();
            setLoading(true);

            const res = await fetch(`/api/groups/${id}/expenses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description,
                    amount: amountCents,
                    currency,
                    payers,
                    splits
                })
            });

            if (res.ok) {
                router.push(`/group/${id}`);
            } else {
                const data = await res.json();
                setError(data.error || "Failed to add expense");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="header mb-4">
                <div>
                    <h1 className="title">Add an Expense</h1>
                    <p className="subtitle">Enter the details of the purchase</p>
                </div>
                <button onClick={() => router.push(`/group/${id}`)} className="btn btn-secondary">Back</button>
            </div>

            <form onSubmit={handleSubmit} className="glass-card">
                {error && <div className="mb-4 text-center text-danger font-bold text-sm bg-red-900 bg-opacity-20 p-2 rounded">{error}</div>}

                <div className="input-group">
                    <label className="input-label">Description</label>
                    <input type="text" className="input-field" required placeholder="e.g. Dinner at Mario's" value={description} onChange={e => setDescription(e.target.value)} />
                </div>

                <div className="input-group flex gap-4">
                    <div style={{ flex: 2 }}>
                        <label className="input-label">Total Amount</label>
                        <input type="number" step="0.01" min="0" className="input-field" required placeholder="0.00" value={amountInput} onChange={e => setAmountInput(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="input-label">Currency</label>
                        <select className="input-field" value={currency} onChange={e => setCurrency(e.target.value)}>
                            {availableCurrencies.map(c => <option key={c} value={c}>{formatCurrencyDisplayName(c)}</option>)}
                        </select>
                    </div>
                </div>

                <hr style={{ borderColor: "var(--card-border)", margin: "2rem 0" }} />

                {/* Who Paid Section */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Who paid?</h3>
                        <select className="input-field" style={{ width: "auto", padding: "0.4rem" }} value={payerMode} onChange={e => setPayerMode(e.target.value as any)}>
                            <option value="EQUAL">Split Equally</option>
                            <option value="EXACT">Exact Amounts</option>
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {participants.map(p => (
                            <div key={p.id} className="flex items-center gap-2" style={{ background: "rgba(255,255,255,0.05)", padding: "0.5rem 1rem", borderRadius: "8px" }}>
                                <input
                                    type="checkbox"
                                    checked={!!selectedPayers[p.id]}
                                    onChange={() => toggleSelection(p.id, selectedPayers, setSelectedPayers)}
                                    style={{ width: "1.2rem", height: "1.2rem" }}
                                />
                                <span style={{ minWidth: "120px" }}>{p.name}</span>
                                {payerMode === "EXACT" && selectedPayers[p.id] && (
                                    <input type="number" step="0.01" min="0" className="input-field" style={{ padding: "0.3rem", fontSize: "0.9rem" }} placeholder="0.00" value={exactPayments[p.id] || ""} onChange={e => setExactPayments({ ...exactPayments, [p.id]: e.target.value })} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <hr style={{ borderColor: "var(--card-border)", margin: "2rem 0" }} />

                {/* Who is Splitting Section */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>For whom?</h3>
                        <select className="input-field" style={{ width: "auto", padding: "0.4rem" }} value={splitMode} onChange={e => setSplitMode(e.target.value as any)}>
                            <option value="EQUAL">Split Equally</option>
                            <option value="EXACT">Exact Amounts</option>
                            <option value="PERCENTAGE">Percentages</option>
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {participants.map(p => (
                            <div key={p.id} className="flex items-center gap-2" style={{ background: "rgba(255,255,255,0.05)", padding: "0.5rem 1rem", borderRadius: "8px" }}>
                                <input
                                    type="checkbox"
                                    checked={!!selectedSplits[p.id]}
                                    onChange={() => toggleSelection(p.id, selectedSplits, setSelectedSplits)}
                                    style={{ width: "1.2rem", height: "1.2rem" }}
                                />
                                <span style={{ minWidth: "120px" }}>{p.name}</span>
                                {splitMode === "EXACT" && selectedSplits[p.id] && (
                                    <input type="number" step="0.01" min="0" className="input-field" style={{ padding: "0.3rem", fontSize: "0.9rem" }} placeholder="0.00" value={exactSplits[p.id] || ""} onChange={e => setExactSplits({ ...exactSplits, [p.id]: e.target.value })} />
                                )}
                                {splitMode === "PERCENTAGE" && selectedSplits[p.id] && (
                                    <input type="number" step="0.01" min="0" max="100" className="input-field" style={{ padding: "0.3rem", fontSize: "0.9rem" }} placeholder="%" value={percentageSplits[p.id] || ""} onChange={e => setPercentageSplits({ ...percentageSplits, [p.id]: e.target.value })} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }} disabled={loading}>
                    {loading ? "Saving..." : "Save Expense"}
                </button>
            </form>
        </div>
    );
}
