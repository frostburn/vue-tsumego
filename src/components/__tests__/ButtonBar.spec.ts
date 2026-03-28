import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import ButtonBar from '../ButtonBar.vue'

describe('ButtonBar', () => {
  it('renders accessible segmented radio controls', () => {
    const wrapper = mount(ButtonBar, { props: { whiteToPlay: false, modelValue: 'play' } })

    const group = wrapper.find('[role="radiogroup"]')
    const options = wrapper.findAll('[role="radio"]')

    expect(group.exists()).toBe(true)
    expect(options).toHaveLength(3)
    expect(options[0]?.text()).toContain('Play')
    expect(options[1]?.text()).toContain('Place Black')
    expect(options[2]?.text()).toContain('Place White')
    expect(options[0]?.attributes('aria-checked')).toBe('true')
  })
})
