import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CouncilAIPanel } from './CouncilAIPanel'

const mockClosePanel = vi.fn()
const mockSendMessage = vi.fn()
const mockCreateTicket = vi.fn()

function makeCouncilMock(overrides = {}) {
  return {
    isPanelOpen: true,
    closePanel: mockClosePanel,
    activeConversation: {
      id: 'conv-1',
      moduleContext: 'decisions',
      messages: [],
      tickets: [],
      createdAt: Date.now(),
      isActive: true,
    },
    activeModuleContext: 'decisions',
    sendMessage: mockSendMessage,
    createTicket: mockCreateTicket,
    openTicketCount: 0,
    tickets: [],
    ...overrides,
  }
}

vi.mock('../lib/CouncilContext', () => ({
  useCouncil: vi.fn(),
}))

import { useCouncil } from '../lib/CouncilContext'
const mockUseCouncil = useCouncil as ReturnType<typeof vi.fn>

describe('CouncilAIPanel', () => {
  it('renders panel when open', () => {
    mockUseCouncil.mockReturnValue(makeCouncilMock())
    render(<CouncilAIPanel />)
    expect(screen.getByRole('complementary', { name: /council ai assistant panel/i })).toBeInTheDocument()
  })

  it('does not show panel content when closed (translate-x-full)', () => {
    mockUseCouncil.mockReturnValue(makeCouncilMock({ isPanelOpen: false }))
    const { container } = render(<CouncilAIPanel />)
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('translate-x-full')
  })

  it('close button calls closePanel', () => {
    mockClosePanel.mockClear()
    mockUseCouncil.mockReturnValue(makeCouncilMock())
    render(<CouncilAIPanel />)
    fireEvent.click(screen.getByRole('button', { name: /close council ai panel/i }))
    expect(mockClosePanel).toHaveBeenCalled()
  })

  it('shows module context in header', () => {
    mockUseCouncil.mockReturnValue(makeCouncilMock({ activeModuleContext: 'audit' }))
    render(<CouncilAIPanel />)
    expect(screen.getByText(/module: audit/i)).toBeInTheDocument()
  })

  it('shows backdrop when panel is open', () => {
    mockUseCouncil.mockReturnValue(makeCouncilMock({ isPanelOpen: true }))
    const { container } = render(<CouncilAIPanel />)
    // Backdrop is a fixed div with aria-hidden
    const backdrops = container.querySelectorAll('[aria-hidden="true"]')
    expect(backdrops.length).toBeGreaterThan(0)
  })

  it('switching to tickets tab shows ticket list area', () => {
    mockUseCouncil.mockReturnValue(makeCouncilMock({ tickets: [] }))
    render(<CouncilAIPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^tickets$/i }))
    expect(screen.getByText(/no tickets yet/i)).toBeInTheDocument()
  })

  it('shows open ticket badge when openTicketCount > 0', () => {
    mockUseCouncil.mockReturnValue(makeCouncilMock({ openTicketCount: 3 }))
    render(<CouncilAIPanel />)
    // Badge appears in the Tickets tab button
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders conversation messages', () => {
    mockUseCouncil.mockReturnValue(makeCouncilMock({
      activeConversation: {
        id: 'conv-1',
        moduleContext: 'decisions',
        messages: [
          { id: 'msg-1', role: 'council', content: 'Hello Governor', timestamp: Date.now() },
          { id: 'msg-2', role: 'user', content: 'What is quorum?', timestamp: Date.now() },
        ],
        tickets: [],
        createdAt: Date.now(),
        isActive: true,
      },
    }))
    render(<CouncilAIPanel />)
    expect(screen.getByText('Hello Governor')).toBeInTheDocument()
    expect(screen.getByText('What is quorum?')).toBeInTheDocument()
  })

  it('Escape key closes the panel', () => {
    mockClosePanel.mockClear()
    mockUseCouncil.mockReturnValue(makeCouncilMock({ isPanelOpen: true }))
    render(<CouncilAIPanel />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockClosePanel).toHaveBeenCalled()
  })
})
