import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useTools } from '@/hooks/useTools'

export function Layout() {
  const { tools, loading } = useTools()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      <Sidebar tools={tools} loading={loading} />
      <main className="ml-64 pt-14 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
