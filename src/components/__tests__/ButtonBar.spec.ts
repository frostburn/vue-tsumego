import { describe, it, expect, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import ButtonBar from '../ButtonBar.vue'

describe('ButtonBar', () => {
  it('renders properly', () => {
    const wrapper = mount(ButtonBar, { propsData: { whiteToPlay: false, modelValue: 'play' } })
    expect(wrapper.findAll('.background')).toHaveLength(1)
    expect(wrapper.findAll('.overlay')).toHaveLength(3)
    expect(wrapper.find('[role="radiogroup"]').attributes('tabindex')).toBe('0')
  })

  it('changes mode with arrow keys', async () => {
    const onUpdate = vi.fn()
    const wrapper = mount(ButtonBar, {
      props: {
        whiteToPlay: false,
        modelValue: 'play',
        'onUpdate:modelValue': onUpdate,
      },
    })

    const radioGroup = wrapper.find('[role="radiogroup"]')
    await radioGroup.trigger('keydown', { key: 'ArrowRight' })

    expect(onUpdate).toHaveBeenLastCalledWith('black')

    await wrapper.setProps({ modelValue: 'black' })
    await radioGroup.trigger('keydown', { key: 'ArrowLeft' })

    expect(onUpdate).toHaveBeenLastCalledWith('play')
  })
})
