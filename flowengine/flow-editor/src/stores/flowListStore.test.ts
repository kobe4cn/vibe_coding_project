/**
 * Flow List Store Tests
 * Unit tests for the flow list page state management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useFlowListStore } from './flowListStore'
import type { FlowEntry } from '@/lib/storage'

// Helper to create test flow entry
function createTestFlowEntry(
  id: string,
  name: string = 'Test Flow'
): FlowEntry {
  return {
    id,
    name,
    description: 'Test description',
    latestVersion: 1,
    versionCount: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('useFlowListStore', () => {
  beforeEach(() => {
    useFlowListStore.getState().reset()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useFlowListStore.getState()

      expect(state.flows).toHaveLength(0)
      expect(state.totalCount).toBe(0)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.search).toBe('')
      expect(state.tags).toHaveLength(0)
      expect(state.sortBy).toBe('updatedAt')
      expect(state.sortOrder).toBe('desc')
      expect(state.page).toBe(1)
      expect(state.pageSize).toBe(20)
      expect(state.selectedFlowIds).toHaveLength(0)
    })
  })

  describe('Flow List Operations', () => {
    describe('setFlows', () => {
      it('should set flows and auto-calculate total count', () => {
        const flows = [
          createTestFlowEntry('1', 'Flow 1'),
          createTestFlowEntry('2', 'Flow 2'),
        ]

        useFlowListStore.getState().setFlows(flows)

        const state = useFlowListStore.getState()
        expect(state.flows).toHaveLength(2)
        expect(state.totalCount).toBe(2)
      })

      it('should allow manual total count override', () => {
        const flows = [createTestFlowEntry('1', 'Flow 1')]

        useFlowListStore.getState().setFlows(flows, 100)

        const state = useFlowListStore.getState()
        expect(state.flows).toHaveLength(1)
        expect(state.totalCount).toBe(100)
      })
    })

    describe('addFlow', () => {
      it('should add flow to the beginning', () => {
        useFlowListStore.getState().setFlows([createTestFlowEntry('1', 'Flow 1')])
        useFlowListStore.getState().addFlow(createTestFlowEntry('2', 'Flow 2'))

        const state = useFlowListStore.getState()
        expect(state.flows).toHaveLength(2)
        expect(state.flows[0].id).toBe('2')
        expect(state.totalCount).toBe(2)
      })
    })

    describe('updateFlow', () => {
      it('should update flow properties', () => {
        useFlowListStore.getState().setFlows([createTestFlowEntry('1', 'Flow 1')])
        useFlowListStore.getState().updateFlow('1', { name: 'Updated Flow' })

        const state = useFlowListStore.getState()
        expect(state.flows[0].name).toBe('Updated Flow')
      })

      it('should not update non-existent flow', () => {
        useFlowListStore.getState().setFlows([createTestFlowEntry('1', 'Flow 1')])
        useFlowListStore.getState().updateFlow('non-existent', { name: 'Test' })

        const state = useFlowListStore.getState()
        expect(state.flows).toHaveLength(1)
        expect(state.flows[0].name).toBe('Flow 1')
      })
    })

    describe('removeFlow', () => {
      it('should remove a flow', () => {
        useFlowListStore.getState().setFlows([
          createTestFlowEntry('1', 'Flow 1'),
          createTestFlowEntry('2', 'Flow 2'),
        ])
        useFlowListStore.getState().removeFlow('1')

        const state = useFlowListStore.getState()
        expect(state.flows).toHaveLength(1)
        expect(state.flows[0].id).toBe('2')
        expect(state.totalCount).toBe(1)
      })

      it('should remove from selection when removing flow', () => {
        useFlowListStore.getState().setFlows([createTestFlowEntry('1', 'Flow 1')])
        useFlowListStore.getState().selectFlow('1')
        useFlowListStore.getState().removeFlow('1')

        const state = useFlowListStore.getState()
        expect(state.selectedFlowIds).toHaveLength(0)
      })
    })
  })

  describe('Loading and Error State', () => {
    describe('setLoading', () => {
      it('should set loading state', () => {
        useFlowListStore.getState().setLoading(true)
        expect(useFlowListStore.getState().loading).toBe(true)

        useFlowListStore.getState().setLoading(false)
        expect(useFlowListStore.getState().loading).toBe(false)
      })
    })

    describe('setError', () => {
      it('should set error state', () => {
        useFlowListStore.getState().setError('Something went wrong')
        expect(useFlowListStore.getState().error).toBe('Something went wrong')

        useFlowListStore.getState().setError(null)
        expect(useFlowListStore.getState().error).toBeNull()
      })
    })
  })

  describe('Search and Filter', () => {
    describe('setSearch', () => {
      it('should set search and reset page', () => {
        useFlowListStore.getState().setPage(5)
        useFlowListStore.getState().setSearch('test')

        const state = useFlowListStore.getState()
        expect(state.search).toBe('test')
        expect(state.page).toBe(1)
      })
    })

    describe('Tag Operations', () => {
      it('should set tags and reset page', () => {
        useFlowListStore.getState().setPage(5)
        useFlowListStore.getState().setTags(['tag1', 'tag2'])

        const state = useFlowListStore.getState()
        expect(state.tags).toEqual(['tag1', 'tag2'])
        expect(state.page).toBe(1)
      })

      it('should add a tag', () => {
        useFlowListStore.getState().addTag('tag1')
        useFlowListStore.getState().addTag('tag2')

        const state = useFlowListStore.getState()
        expect(state.tags).toEqual(['tag1', 'tag2'])
      })

      it('should not add duplicate tag', () => {
        useFlowListStore.getState().addTag('tag1')
        useFlowListStore.getState().addTag('tag1')

        const state = useFlowListStore.getState()
        expect(state.tags).toHaveLength(1)
      })

      it('should remove a tag', () => {
        useFlowListStore.getState().setTags(['tag1', 'tag2'])
        useFlowListStore.getState().removeTag('tag1')

        const state = useFlowListStore.getState()
        expect(state.tags).toEqual(['tag2'])
      })
    })

    describe('Sort Operations', () => {
      it('should set sort by', () => {
        useFlowListStore.getState().setSortBy('name')
        expect(useFlowListStore.getState().sortBy).toBe('name')
      })

      it('should set sort order', () => {
        useFlowListStore.getState().setSortOrder('asc')
        expect(useFlowListStore.getState().sortOrder).toBe('asc')
      })

      it('should toggle sort order', () => {
        expect(useFlowListStore.getState().sortOrder).toBe('desc')

        useFlowListStore.getState().toggleSortOrder()
        expect(useFlowListStore.getState().sortOrder).toBe('asc')

        useFlowListStore.getState().toggleSortOrder()
        expect(useFlowListStore.getState().sortOrder).toBe('desc')
      })
    })
  })

  describe('Pagination', () => {
    beforeEach(() => {
      // Set up a scenario with multiple pages
      useFlowListStore.getState().setFlows([], 100)
      useFlowListStore.getState().setPageSize(10)
    })

    describe('setPage', () => {
      it('should set page', () => {
        useFlowListStore.getState().setPage(5)
        expect(useFlowListStore.getState().page).toBe(5)
      })

      it('should not set page below 1', () => {
        useFlowListStore.getState().setPage(-5)
        expect(useFlowListStore.getState().page).toBe(1)
      })
    })

    describe('setPageSize', () => {
      it('should set page size and reset to page 1', () => {
        useFlowListStore.getState().setPage(5)
        useFlowListStore.getState().setPageSize(20)

        const state = useFlowListStore.getState()
        expect(state.pageSize).toBe(20)
        expect(state.page).toBe(1)
      })
    })

    describe('nextPage', () => {
      it('should go to next page', () => {
        useFlowListStore.getState().nextPage()
        expect(useFlowListStore.getState().page).toBe(2)
      })

      it('should not exceed max page', () => {
        useFlowListStore.getState().setPage(10) // Last page (100 items / 10 per page)
        useFlowListStore.getState().nextPage()
        expect(useFlowListStore.getState().page).toBe(10)
      })
    })

    describe('prevPage', () => {
      it('should go to previous page', () => {
        useFlowListStore.getState().setPage(5)
        useFlowListStore.getState().prevPage()
        expect(useFlowListStore.getState().page).toBe(4)
      })

      it('should not go below page 1', () => {
        useFlowListStore.getState().prevPage()
        expect(useFlowListStore.getState().page).toBe(1)
      })
    })
  })

  describe('Selection', () => {
    beforeEach(() => {
      useFlowListStore.getState().setFlows([
        createTestFlowEntry('1', 'Flow 1'),
        createTestFlowEntry('2', 'Flow 2'),
        createTestFlowEntry('3', 'Flow 3'),
      ])
    })

    describe('selectFlow', () => {
      it('should select a flow', () => {
        useFlowListStore.getState().selectFlow('1')
        expect(useFlowListStore.getState().selectedFlowIds).toEqual(['1'])
      })

      it('should not duplicate selection', () => {
        useFlowListStore.getState().selectFlow('1')
        useFlowListStore.getState().selectFlow('1')
        expect(useFlowListStore.getState().selectedFlowIds).toHaveLength(1)
      })
    })

    describe('deselectFlow', () => {
      it('should deselect a flow', () => {
        useFlowListStore.getState().selectFlow('1')
        useFlowListStore.getState().selectFlow('2')
        useFlowListStore.getState().deselectFlow('1')

        expect(useFlowListStore.getState().selectedFlowIds).toEqual(['2'])
      })
    })

    describe('toggleFlowSelection', () => {
      it('should toggle selection on', () => {
        useFlowListStore.getState().toggleFlowSelection('1')
        expect(useFlowListStore.getState().selectedFlowIds).toContain('1')
      })

      it('should toggle selection off', () => {
        useFlowListStore.getState().selectFlow('1')
        useFlowListStore.getState().toggleFlowSelection('1')
        expect(useFlowListStore.getState().selectedFlowIds).not.toContain('1')
      })
    })

    describe('selectAllFlows', () => {
      it('should select all flows', () => {
        useFlowListStore.getState().selectAllFlows()
        expect(useFlowListStore.getState().selectedFlowIds).toEqual(['1', '2', '3'])
      })
    })

    describe('clearSelection', () => {
      it('should clear all selection', () => {
        useFlowListStore.getState().selectAllFlows()
        useFlowListStore.getState().clearSelection()
        expect(useFlowListStore.getState().selectedFlowIds).toHaveLength(0)
      })
    })
  })

  describe('getListOptions', () => {
    it('should return current list options', () => {
      useFlowListStore.getState().setSearch('test')
      useFlowListStore.getState().setTags(['tag1'])
      useFlowListStore.getState().setSortBy('name')
      useFlowListStore.getState().setSortOrder('asc')
      useFlowListStore.getState().setPageSize(10)
      useFlowListStore.getState().setPage(2)

      const options = useFlowListStore.getState().getListOptions()

      expect(options).toEqual({
        search: 'test',
        tags: ['tag1'],
        sortBy: 'name',
        sortOrder: 'asc',
        limit: 10,
        offset: 10, // (page 2 - 1) * pageSize 10
      })
    })

    it('should not include empty search', () => {
      const options = useFlowListStore.getState().getListOptions()
      expect(options.search).toBeUndefined()
    })

    it('should not include empty tags', () => {
      const options = useFlowListStore.getState().getListOptions()
      expect(options.tags).toBeUndefined()
    })
  })

  describe('Reset', () => {
    it('should reset to initial state', () => {
      // Make some changes
      useFlowListStore.getState().setFlows([createTestFlowEntry('1', 'Flow 1')])
      useFlowListStore.getState().setSearch('test')
      useFlowListStore.getState().setPage(5)
      useFlowListStore.getState().selectFlow('1')

      // Reset
      useFlowListStore.getState().reset()

      const state = useFlowListStore.getState()
      expect(state.flows).toHaveLength(0)
      expect(state.search).toBe('')
      expect(state.page).toBe(1)
      expect(state.selectedFlowIds).toHaveLength(0)
    })
  })
})
