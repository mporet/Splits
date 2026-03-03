"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export function Navigation() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [savedGroups, setSavedGroups] = useState<{ id: string, name: string }[]>([]);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
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
        fetchSavedGroups();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (pathname === "/") return null; // Don't show on landing

    return (
        <nav style={{ padding: "1rem 2rem", borderBottom: "1px solid var(--card-border)", background: "var(--card-bg)", backdropFilter: "blur(var(--glass-blur))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
                <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem", fontWeight: "bold", textDecoration: "none" }}>
                    <span style={{ fontSize: "1.5rem" }}>🤸‍♀️</span>
                    <span style={{ background: "linear-gradient(135deg, #fff, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        Splits
                    </span>
                </Link>
            </div>
            <div style={{ position: "relative" }} ref={menuRef}>
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem" }}
                >
                    {session?.user?.image ? (
                        <img src={session.user.image} alt="Profile" style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                    ) : (
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold" }}>
                            {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "👤"}
                        </div>
                    )}
                </button>

                {menuOpen && (
                    <div style={{ position: "absolute", top: "100%", right: 0, marginTop: "0.5rem", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "8px", padding: "0.5rem", minWidth: "220px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", zIndex: 50 }}>
                        {session?.user ? (
                            <>
                                <div style={{ padding: "0.5rem", borderBottom: "1px solid var(--card-border)", marginBottom: "0.5rem" }}>
                                    <div style={{ fontWeight: "bold" }}>{session.user.name}</div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{session.user.email}</div>
                                </div>
                                <Link onClick={() => setMenuOpen(false)} href="/dashboard" style={{ display: "block", padding: "0.5rem", textDecoration: "none", color: "var(--foreground)", borderRadius: "4px" }}>Group Dashboard</Link>
                                <Link onClick={() => setMenuOpen(false)} href="/dashboard" style={{ display: "block", padding: "0.5rem", textDecoration: "none", color: "var(--foreground)", borderRadius: "4px" }}>Create Group</Link>

                                <div style={{ padding: "0.5rem 0", color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: "bold" }}>Change Group</div>
                                <select
                                    className="input-field"
                                    style={{ width: "100%", padding: "0.4rem", marginBottom: "0.5rem" }}
                                    value=""
                                    onChange={(e) => {
                                        setMenuOpen(false);
                                        if (e.target.value) {
                                            router.push(e.target.value === "/" ? "/" : `/group/${e.target.value}`);
                                        }
                                    }}
                                >
                                    <option value="" disabled>Switch Group...</option>
                                    {savedGroups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                    <option value="/">View All Saved Groups</option>
                                </select>

                                <button onClick={() => { setMenuOpen(false); signOut(); }} style={{ width: "100%", textAlign: "left", padding: "0.5rem", background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", borderRadius: "4px" }}>Log out</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { setMenuOpen(false); signIn("google"); }} style={{ width: "100%", textAlign: "left", padding: "0.5rem", background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer", borderRadius: "4px", fontWeight: "bold" }}>Login to create a group</button>

                                <div style={{ padding: "0.5rem 0", color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: "bold", marginTop: "0.5rem" }}>Change Group</div>
                                <select
                                    className="input-field"
                                    style={{ width: "100%", padding: "0.4rem", marginBottom: "0.5rem" }}
                                    value=""
                                    onChange={(e) => {
                                        setMenuOpen(false);
                                        if (e.target.value) {
                                            router.push(e.target.value === "/" ? "/" : `/group/${e.target.value}`);
                                        }
                                    }}
                                >
                                    <option value="" disabled>Switch Group...</option>
                                    {savedGroups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                    <option value="/">View All Saved Groups</option>
                                </select>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
