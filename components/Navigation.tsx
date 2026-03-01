"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
    const { data: session } = useSession();
    const pathname = usePathname();

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
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                {session?.user ? (
                    <>
                        <Link href="/dashboard" className="btn btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>Dashboard</Link>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{session.user.name}</span>
                        <button onClick={() => signOut()} className="btn btn-danger" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>Log out</button>
                    </>
                ) : (
                    <Link href="/" className="btn btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>Home</Link>
                )}
            </div>
        </nav>
    );
}
