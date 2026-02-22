import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import ButtonBar from '../ButtonBar.vue'

describe('ButtonBar', () => {
  it('renders properly', () => {
    const wrapper = mount(ButtonBar)
    expect(wrapper.findAll('.background')).toHaveLength(1)
    expect(wrapper.findAll('.overlay')).toHaveLength(3)
  })
})
