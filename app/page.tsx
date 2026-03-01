"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";

interface SavedGroup {
    id: string;
    name: string;
    isClosed: boolean;
}

function HomeContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [groupId, setGroupId] = useState("");
    const [passcode, setPasscode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
    const [loadingSaved, setLoadingSaved] = useState(true);

    useEffect(() => {
        if (status === "authenticated") {
            router.push("/dashboard");
        }
    }, [status, router]);

    useEffect(() => {
        // Autofill from URL
        const urlGroupId = searchParams.get("groupId");
        if (urlGroupId) {
            setGroupId(urlGroupId);
        }

        // Fetch saved groups
        const fetchSavedGroups = async () => {
            try {
                const res = await fetch("/api/groups/saved");
                if (res.ok) {
                    const data = await res.json();
                    setSavedGroups(data.groups || []);
                }
            } catch (err) {
                console.error("Failed to load saved groups", err);
            } finally {
                setLoadingSaved(false);
            }
        };

        fetchSavedGroups();
    }, [searchParams]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`/api/groups/${groupId}/access`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ passcode }),
            });

            if (res.ok) {
                router.push(`/group/${groupId}`);
            } else {
                const data = await res.json();
                setError(data.error || "Failed to join group");
            }
        } catch (err) {
            setError("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (status === "loading") {
        return <div className="container text-center mt-4">Loading...</div>;
    }

    return (
        <div className="container" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem", padding: "2rem 0" }}>
            <div className="glass-card" style={{ maxWidth: "450px", width: "100%" }}>
                <div className="text-center mb-4">
                    <h1 className="title" style={{ fontSize: "2.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "2.5rem" }}>🤸‍♀️</span> Splits
                    </h1>
                    <p className="subtitle mt-1">Settle up your expenses easily</p>
                </div>

                <form onSubmit={handleJoin} className="mb-4">
                    <div className="input-group">
                        <label className="input-label">Group ID</label>
                        <input
                            type="text"
                            className="input-field"
                            required
                            placeholder="e.g. blue-sky-42"
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Passcode</label>
                        <input
                            type="password"
                            className="input-field"
                            required
                            placeholder="Enter group passcode"
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                        />
                    </div>

                    {error && <p className="text-danger mb-2 text-center" style={{ color: "var(--danger)" }}>{error}</p>}

                    <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                        {loading ? "Joining..." : "Join Group as Participant"}
                    </button>
                </form>

                <div style={{ display: "flex", alignItems: "center", margin: "2rem 0" }}>
                    <div style={{ flex: 1, height: "1px", background: "var(--card-border)" }}></div>
                    <span style={{ padding: "0 1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>OR</span>
                    <div style={{ flex: 1, height: "1px", background: "var(--card-border)" }}></div>
                </div>

                <button
                    onClick={() => signIn("google")}
                    className="btn btn-secondary"
                    style={{ width: "100%" }}
                >
                    Sign in with Google as Admin
                </button>
            </div>

            {/* Saved Groups Section */}
            {!loadingSaved && savedGroups.length > 0 && (
                <div className="glass-card" style={{ maxWidth: "450px", width: "100%", textAlign: "center" }}>
                    <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem" }}>Recent Groups</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {savedGroups.map(group => (
                            <Link
                                key={group.id}
                                href={`/group/${group.id}`}
                                className="btn btn-secondary"
                                style={{ width: "100%", justifyContent: "space-between", display: "flex", padding: "0.75rem 1rem" }}
                            >
                                <span style={{ fontWeight: "bold" }}>{group.name}</span>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                    {group.isClosed ? "Closed" : "Active"}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<div className="container text-center mt-4">Loading...</div>}>
            <HomeContent />
        </Suspense>
    );
}
