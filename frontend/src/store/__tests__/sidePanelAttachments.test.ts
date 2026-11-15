import { describe, expect, it } from 'vitest'
import { attachedItemId, dropOtherAttachments, useSidePanelStore } from '../sidePanelStore'

describe('dropOtherAttachments', () => {
    it('換對話時只留這個對話附加的檔案，正在看的別的對話檔案會收起來', async () => {
        const store = useSidePanelStore.getState()
        store.register(attachedItemId('a', 'x.html'), { kind: 'page', code: '<p>a</p>', language: 'html', title: 'x.html' }, null)
        store.register(attachedItemId('b', 'y.html'), { kind: 'page', code: '<p>b</p>', language: 'html', title: 'y.html' }, null)
        useSidePanelStore.getState().show(attachedItemId('a', 'x.html'))
        dropOtherAttachments('b')
        await Promise.resolve()
        const after = useSidePanelStore.getState()
        expect(Object.keys(after.items)).toEqual([attachedItemId('b', 'y.html')])
        expect(after.currentId).not.toBe(attachedItemId('a', 'x.html'))
    })
})
