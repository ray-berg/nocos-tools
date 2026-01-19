import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white">404</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Page not found</p>
      <Link
        to="/"
        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
      >
        Go Home
      </Link>
    </div>
  )
}
