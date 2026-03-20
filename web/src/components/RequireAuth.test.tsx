import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Provide a controllable mock before any import of RequireAuth
let mockAuth = { isLoading: false, isAuthenticated: false }
vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}))

import { RequireAuth } from './RequireAuth'

function wrap(auth: typeof mockAuth) {
  mockAuth = auth
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected Content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireAuth', () => {
  it('shows loading while auth resolves', () => {
    wrap({ isLoading: true, isAuthenticated: false })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    wrap({ isLoading: false, isAuthenticated: true })
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    wrap({ isLoading: false, isAuthenticated: false })
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})
