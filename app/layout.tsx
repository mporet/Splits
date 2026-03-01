import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import { Navigation } from '@/components/Navigation'
import './globals.css'

export const metadata: Metadata = {
    title: 'Splits - Expense Sharing',
    description: 'A beautiful and simple expense sharing app',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                <Providers>
                    <Navigation />
                    {children}
                </Providers>
            </body>
        </html>
    )
}
