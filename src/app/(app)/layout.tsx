import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import Providers from '@/components/providers'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const email = user.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <Providers>
      <div className="min-h-screen flex flex-col" style={{ background: '#FAF7F2' }}>
        <AppHeader userInitials={initials} userEmail={email} />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </Providers>
  )
}
