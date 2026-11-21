import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { compareValues, useTableSort } from '../useTableSort'

describe('compareValues', () => {
    it('puts empty values last in both directions', () => {
        expect(compareValues('', 'a', 'asc')).toBe(1)
        expect(compareValues('', 'a', 'desc')).toBe(1)
    })
    it('compares numbers by size and text naturally', () => {
        expect(compareValues(2, 10, 'asc')).toBeLessThan(0)
        expect(compareValues('item 2', 'item 10', 'asc')).toBeLessThan(0)
    })
})

describe('useTableSort', () => {
    const rows = [{ n: 'b', v: 2 }, { n: 'a', v: 3 }, { n: 'c', v: 1 }]

    it('cycles asc → desc → original order', () => {
        const { result } = renderHook(() => useTableSort(rows, { name: (r) => r.n, value: (r) => r.v }))
        act(() => result.current.headerProps('name').onSort())
        expect(result.current.rows.map((r) => r.n)).toEqual(['a', 'b', 'c'])
        act(() => result.current.headerProps('name').onSort())
        expect(result.current.rows.map((r) => r.n)).toEqual(['c', 'b', 'a'])
        act(() => result.current.headerProps('name').onSort())
        expect(result.current.rows.map((r) => r.n)).toEqual(['b', 'a', 'c'])
    })

    it('a new column starts ascending', () => {
        const { result } = renderHook(() => useTableSort(rows, { name: (r) => r.n, value: (r) => r.v }))
        act(() => result.current.headerProps('name').onSort())
        act(() => result.current.headerProps('value').onSort())
        expect(result.current.headerProps('value').dir).toBe('asc')
        expect(result.current.rows.map((r) => r.v)).toEqual([1, 2, 3])
    })
})
