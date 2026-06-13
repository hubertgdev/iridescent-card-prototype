import { expect, it } from 'vitest'

it('renders a paragraph into the DOM', () => {
  const p = document.createElement('p')
  p.textContent = 'hello'
  document.body.appendChild(p)

  expect(document.body.querySelector('p')?.textContent).toBe('hello')
})
