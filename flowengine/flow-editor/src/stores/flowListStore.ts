/**
 * Flow List Store
 * State management for the flow list page
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { FlowEntry, ListOptions } from '@/lib/storage'

interface FlowListState {
  // Flow list data
  flows: FlowEntry[]
  totalCount: number
  loading: boolean
  error: string | null

  // Search and filter
  search: string
  tags: string[]
  sortBy: ListOptions['sortBy']
  sortOrder: ListOptions['sortOrder']

  // Pagination
  page: number
  pageSize: number

  // Selection (for bulk operations)
  selectedFlowIds: string[]

  // Actions
  setFlows: (flows: FlowEntry[], totalCount?: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Search and filter actions
  setSearch: (search: string) => void
  setTags: (tags: string[]) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  setSortBy: (sortBy: ListOptions['sortBy']) => void
  setSortOrder: (sortOrder: ListOptions['sortOrder']) => void
  toggleSortOrder: () => void

  // Pagination actions
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  nextPage: () => void
  prevPage: () => void

  // Selection actions
  selectFlow: (flowId: string) => void
  deselectFlow: (flowId: string) => void
  toggleFlowSelection: (flowId: string) => void
  selectAllFlows: () => void
  clearSelection: () => void

  // Flow list operations
  addFlow: (flow: FlowEntry) => void
  updateFlow: (flowId: string, updates: Partial<FlowEntry>) => void
  removeFlow: (flowId: string) => void

  // Reset
  reset: () => void

  // Get current list options
  getListOptions: () => ListOptions
}

const initialState = {
  flows: [] as FlowEntry[],
  totalCount: 0,
  loading: false,
  error: null as string | null,
  search: '',
  tags: [] as string[],
  sortBy: 'updatedAt' as ListOptions['sortBy'],
  sortOrder: 'desc' as ListOptions['sortOrder'],
  page: 1,
  pageSize: 20,
  selectedFlowIds: [] as string[],
}

export const useFlowListStore = create<FlowListState>()(
  immer((set, get) => ({
    ...initialState,

    setFlows: (flows, totalCount) =>
      set((state) => {
        state.flows = flows
        if (totalCount !== undefined) {
          state.totalCount = totalCount
        } else {
          state.totalCount = flows.length
        }
      }),

    setLoading: (loading) =>
      set((state) => {
        state.loading = loading
      }),

    setError: (error) =>
      set((state) => {
        state.error = error
      }),

    setSearch: (search) =>
      set((state) => {
        state.search = search
        state.page = 1 // Reset to first page on search
      }),

    setTags: (tags) =>
      set((state) => {
        state.tags = tags
        state.page = 1
      }),

    addTag: (tag) =>
      set((state) => {
        if (!state.tags.includes(tag)) {
          state.tags.push(tag)
          state.page = 1
        }
      }),

    removeTag: (tag) =>
      set((state) => {
        state.tags = state.tags.filter((t) => t !== tag)
        state.page = 1
      }),

    setSortBy: (sortBy) =>
      set((state) => {
        state.sortBy = sortBy
      }),

    setSortOrder: (sortOrder) =>
      set((state) => {
        state.sortOrder = sortOrder
      }),

    toggleSortOrder: () =>
      set((state) => {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
      }),

    setPage: (page) =>
      set((state) => {
        state.page = Math.max(1, page)
      }),

    setPageSize: (pageSize) =>
      set((state) => {
        state.pageSize = pageSize
        state.page = 1
      }),

    nextPage: () =>
      set((state) => {
        const maxPage = Math.ceil(state.totalCount / state.pageSize)
        if (state.page < maxPage) {
          state.page++
        }
      }),

    prevPage: () =>
      set((state) => {
        if (state.page > 1) {
          state.page--
        }
      }),

    selectFlow: (flowId) =>
      set((state) => {
        if (!state.selectedFlowIds.includes(flowId)) {
          state.selectedFlowIds.push(flowId)
        }
      }),

    deselectFlow: (flowId) =>
      set((state) => {
        state.selectedFlowIds = state.selectedFlowIds.filter((id) => id !== flowId)
      }),

    toggleFlowSelection: (flowId) =>
      set((state) => {
        const index = state.selectedFlowIds.indexOf(flowId)
        if (index === -1) {
          state.selectedFlowIds.push(flowId)
        } else {
          state.selectedFlowIds.splice(index, 1)
        }
      }),

    selectAllFlows: () =>
      set((state) => {
        state.selectedFlowIds = state.flows.map((f) => f.id)
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedFlowIds = []
      }),

    addFlow: (flow) =>
      set((state) => {
        state.flows.unshift(flow)
        state.totalCount++
      }),

    updateFlow: (flowId, updates) =>
      set((state) => {
        const index = state.flows.findIndex((f) => f.id === flowId)
        if (index !== -1) {
          state.flows[index] = { ...state.flows[index], ...updates }
        }
      }),

    removeFlow: (flowId) =>
      set((state) => {
        state.flows = state.flows.filter((f) => f.id !== flowId)
        state.selectedFlowIds = state.selectedFlowIds.filter((id) => id !== flowId)
        state.totalCount--
      }),

    reset: () => set(initialState),

    getListOptions: () => {
      const state = get()
      return {
        search: state.search || undefined,
        tags: state.tags.length > 0 ? state.tags : undefined,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        limit: state.pageSize,
        offset: (state.page - 1) * state.pageSize,
      }
    },
  }))
)

// Selector hooks
export const useFlowList = () => useFlowListStore((state) => state.flows)
export const useFlowListLoading = () => useFlowListStore((state) => state.loading)
export const useFlowListError = () => useFlowListStore((state) => state.error)
export const useFlowListSearch = () => useFlowListStore((state) => state.search)
export const useFlowListTags = () => useFlowListStore((state) => state.tags)
export const useFlowListSort = () =>
  useFlowListStore((state) => ({ sortBy: state.sortBy, sortOrder: state.sortOrder }))
export const useFlowListPagination = () =>
  useFlowListStore((state) => ({
    page: state.page,
    pageSize: state.pageSize,
    totalCount: state.totalCount,
    totalPages: Math.ceil(state.totalCount / state.pageSize),
  }))
export const useSelectedFlowIds = () => useFlowListStore((state) => state.selectedFlowIds)
