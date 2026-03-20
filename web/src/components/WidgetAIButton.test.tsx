import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetAIButton } from './WidgetAIButton'

const mockOpenPanel = vi.fn()

vi.mock('../lib/CouncilContext', () => ({
  useCouncil: () => ({ openPanel: mockOpenPanel }),
}))

describe('WidgetAIButton', () => {
  it('renders with aria-label for the module type', () => {
    render(<WidgetAIButton moduleType="decisions" widgetId="widget-1" />)
    const btn = screen.getByRole('button', { name: /open ai assistant for decisions/i })
    expect(btn).toBeInTheDocument()
  })

  it('calls openPanel with moduleType and widgetId on click', () => {
    mockOpenPanel.mockClear()
    render(<WidgetAIButton moduleType="governance" widgetId="wid-42" />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenPanel).toHaveBeenCalledWith('governance', 'wid-42')
  })

  it('shows AI text label in non-compact mode', () => {
    render(<WidgetAIButton moduleType="audit" widgetId="wid-1" />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('hides AI text label in compact mode', () => {
    render(<WidgetAIButton moduleType="audit" widgetId="wid-1" compact />)
    expect(screen.queryByText('AI')).not.toBeInTheDocument()
  })
})
