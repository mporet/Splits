"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCurrencyDisplayName } from "@/lib/currencyFormat";

type ParticipantState = {
    id?: string;
    name: string;
    _deleted?: boolean;
};

export default function EditGroupPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const { status } = useSession();

    const [groupName, setGroupName] = useState("");
    const [groupPasscode, setGroupPasscode] = useState("");
    const [finalCurrency, setFinalCurrency] = useState("USD");
    const [defaultExpenseCurrency, setDefaultExpenseCurrency] = useState("USD");
    const [participants, setParticipants] = useState<ParticipantState[]>([]);
    const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
            return;
        }

        fetch(`/api/groups/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data.group) {
                    if (!data.isAdmin) {
                        router.push(`/group/${id}`);
                        return;
                    }

                    setGroupName(data.group.name);
                    setGroupPasscode(data.group.passcode);
                    setFinalCurrency(data.group.finalCurrency);
                    setDefaultExpenseCurrency(data.group.defaultExpenseCurrency);

                    if (data.group.participants) {
                        setParticipants(data.group.participants.map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            _deleted: false
                        })));
                    }
                }
            })
            .catch(() => setError("Failed to load group."))
            .finally(() => setLoading(false));

        fetch("https://open.er-api.com/v6/latest/USD")
            .then(res => res.json())
            .then(data => {
                if (data && data.rates) {
                    setAvailableCurrencies(Object.keys(data.rates).sort());
                }
            })
            .catch(() => {
                setAvailableCurrencies(["USD", "EUR", "GBP", "CAD", "AUD", "JPY"]);
            });
    }, [id, status, router]);

    const handleAddParticipant = () => {
        setParticipants([...participants, { name: "", _deleted: false }]);
    };

    const handleRemoveParticipant = (index: number) => {
        const newParticipants = [...participants];
        if (newParticipants[index].id) {
            newParticipants[index]._deleted = true; // Mark for deletion if it exists in DB
        } else {
            newParticipants.splice(index, 1); // Just remove from array if not saved yet
        }
        setParticipants(newParticipants);
    };

    const handleParticipantNameChange = (index: number, newName: string) => {
        const newParticipants = [...participants];
        newParticipants[index].name = newName;
        setParticipants(newParticipants);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSaving(true);

        // Filter out empty names that aren't marked for deletion
        const validParticipants = participants.filter(p => (p.name.trim() !== "" || p._deleted));

        try {
            const res = await fetch(`/api/groups/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: groupName,
                    passcode: groupPasscode,
                    finalCurrency,
                    defaultExpenseCurrency,
                    participants: validParticipants
                })
            });

            if (res.ok) {
                router.push(`/group/${id}`);
            } else {
                const data = await res.json();
                setError(data.error || "Failed to save group.");
            }
        } catch (err) {
            setError("An error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGroup = async () => {
        if (!confirm("Are you ABSOLUTELY sure you want to delete this group? All expenses and settlement data will be permanently wiped. This action cannot be undone.")) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/groups/${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                router.push("/dashboard");
            } else {
                setError("Failed to delete group.");
                setSaving(false);
            }
        } catch (err) {
            setError("An error occurred while deleting.");
            setSaving(false);
        }
    };

    if (loading) return <div className="container mt-4 text-center">Loading...</div>;

    // Filter out deleted for rendering
    const visibleParticipants = participants.map((p, index) => ({ ...p, originalIndex: index })).filter(p => !p._deleted);

    return (
        <div className="container">
            <div className="header mb-4">
                <div>
                    <h1 className="title">Edit Group Details</h1>
                    <p className="subtitle">Update settings and manage participants</p>
                </div>
                <button onClick={() => router.push(`/group/${id}`)} className="btn btn-secondary">Cancel</button>
            </div>

            <form onSubmit={handleSave} className="glass-card mb-4">
                {error && <div className="mb-4 text-center text-danger font-bold text-sm bg-red-900 bg-opacity-20 p-2 rounded">{error}</div>}

                <div className="input-group">
                    <label className="input-label">Group Name</label>
                    <input type="text" className="input-field" required value={groupName} onChange={e => setGroupName(e.target.value)} />
                </div>

                <div className="input-group">
                    <label className="input-label">Passcode</label>
                    <input type="text" className="input-field" required value={groupPasscode} onChange={e => setGroupPasscode(e.target.value)} />
                </div>

                <div className="input-group flex gap-4" style={{ flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 250px" }}>
                        <label className="input-label">Default Expense Currency</label>
                        <select className="input-field" value={defaultExpenseCurrency} onChange={e => setDefaultExpenseCurrency(e.target.value)}>
                            {availableCurrencies.map(c => <option key={c} value={c}>{formatCurrencyDisplayName(c)}</option>)}
                        </select>
                    </div>

                    <div style={{ flex: "1 1 250px" }}>
                        <label className="input-label">Settlement Currency</label>
                        <select className="input-field" value={finalCurrency} onChange={e => setFinalCurrency(e.target.value)}>
                            {availableCurrencies.map(c => <option key={c} value={c}>{formatCurrencyDisplayName(c)}</option>)}
                        </select>
                    </div>
                </div>

                <hr style={{ borderColor: "var(--card-border)", margin: "2rem 0" }} />

                <div className="mb-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Manage Participants</h3>
                        <button type="button" onClick={handleAddParticipant} className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                            + Add Person
                        </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {visibleParticipants.map((p) => (
                            <div key={p.originalIndex} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    className="input-field"
                                    style={{ flex: 1 }}
                                    value={p.name}
                                    onChange={(e) => handleParticipantNameChange(p.originalIndex, e.target.value)}
                                    placeholder="Enter name"
                                    required
                                />
                                <button type="button" onClick={() => handleRemoveParticipant(p.originalIndex)} className="btn btn-danger" style={{ padding: "0.5rem 0.8rem" }}>
                                    X
                                </button>
                            </div>
                        ))}
                    </div>
                    <p className="text-muted text-sm mt-3">Note: You cannot remove a participant if they are already tied to an existing expense.</p>
                </div>

                <div className="flex gap-4 mt-6">
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>

            <div className="glass-card" style={{ border: "1px solid var(--danger)", background: "rgba(220, 38, 38, 0.05)" }}>
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h3 className="text-danger font-bold mb-1">Danger Zone</h3>
                        <p className="text-muted text-sm">Delete this group and all its expenses definitively.</p>
                    </div>
                    <button onClick={handleDeleteGroup} className="btn btn-danger" disabled={saving}>
                        Delete Group Permanently
                    </button>
                </div>
            </div>
        </div>
    );
}
