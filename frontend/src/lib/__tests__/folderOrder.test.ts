import { beforeEach, describe, expect, it } from 'vitest'
import { applyOrder, loadOrder, moveName, saveOrder } from '../folderOrder'

describe('folderOrder', () => {
    beforeEach(() => localStorage.clear())

    it('orders by the saved list and keeps new folders at the end in their own order', () => {
        expect(applyOrder(['A', 'B', 'C', 'D'], ['C', 'A'])).toEqual(['C', 'A', 'B', 'D'])
    })

    it('ignores saved names that no longer exist', () => {
        expect(applyOrder(['A', 'B'], ['X', 'B'])).toEqual(['B', 'A'])
    })

    it('moves an item', () => {
        expect(moveName(['A', 'B', 'C'], 0, 2)).toEqual(['B', 'C', 'A'])
        expect(moveName(['A', 'B', 'C'], 2, 0)).toEqual(['C', 'A', 'B'])
    })

    it('keeps each account separate', () => {
        saveOrder('u1', ['B', 'A'])
        expect(loadOrder('u1')).toEqual(['B', 'A'])
        expect(loadOrder('u2')).toEqual([])
        expect(loadOrder(undefined)).toEqual([])
    })
})
