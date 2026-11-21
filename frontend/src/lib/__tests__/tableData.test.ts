import { describe, expect, it } from 'vitest'
import { chartPlan, parseNum, readTable, toCsv, toTsv } from '../tableData'

describe('parseNum', () => {
    it.each([
        ['1,234', 1234],
        ['NT$ 500', 500],
        ['12.5%', 12.5],
        ['3 萬', 30000],
        ['-8', -8],
        ['1，200 元', 1200],
    ])('%s → %d', (s, n) => expect(parseNum(s)).toBe(n))

    it.each(['', '台北', '2024-01', '第 3 季', 'abc123def'])('%s is not a number', (s) => expect(parseNum(s)).toBeNull())
})

describe('chartPlan', () => {
    it('uses the first text column as labels and numeric columns as bars', () => {
        const plan = chartPlan({ head: ['部門', '人數', '預算(萬)'], rows: [['研發', '12', '30'], ['業務', '8', '25'], ['管理', '3', '10']] })
        expect(plan?.labelCol).toBe(0)
        expect(plan?.valueCols).toEqual([1, 2])
        expect(plan?.data[1]).toEqual({ label: '業務', v1: 8, v2: 25 })
    })

    it('treats an all-number first column (years) as labels', () => {
        const plan = chartPlan({ head: ['年份', '營收'], rows: [['2023', '120'], ['2024', '150']] })
        expect(plan?.labelCol).toBe(0)
        expect(plan?.valueCols).toEqual([1])
    })

    it('drops a column on a very different scale', () => {
        const plan = chartPlan({ head: ['項目', '金額', '比例'], rows: [['A', '50000', '40%'], ['B', '75000', '60%']] })
        expect(plan?.valueCols).toEqual([1])
    })

    it('skips text-only tables and single-row tables', () => {
        expect(chartPlan({ head: ['名稱', '說明'], rows: [['A', '甲'], ['B', '乙']] })).toBeNull()
        expect(chartPlan({ head: ['名稱', '數量'], rows: [['A', '1']] })).toBeNull()
    })
})

describe('export', () => {
    const t = { head: ['名稱', '備註'], rows: [['A', '有,逗號'], ['B', '說 "好"']] }

    it('CSV has a BOM and quotes fields that need it', () => {
        expect(toCsv(t)).toBe('﻿名稱,備註\r\nA,"有,逗號"\r\nB,"說 ""好"""')
    })

    it('TSV is tab separated for pasting into Excel', () => {
        expect(toTsv(t)).toBe('名稱\t備註\nA\t有,逗號\nB\t說 "好"')
    })

    it('reads a rendered table', () => {
        document.body.innerHTML = '<table><thead><tr><th>甲</th><th>乙</th></tr></thead><tbody><tr><td> 1 </td><td>2</td></tr></tbody></table>'
        expect(readTable(document.querySelector('table')!)).toEqual({ head: ['甲', '乙'], rows: [['1', '2']] })
    })
})
