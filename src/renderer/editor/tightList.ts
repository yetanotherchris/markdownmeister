

import { bulletListSchema } from '@milkdown/kit/preset/commonmark'
import { extendListItemSchemaForTask } from '@milkdown/kit/preset/gfm'

/** bullet_list: coerce `spread` so tight bullet lists stay tight. */
export const fixedBulletListSchema = bulletListSchema.extendSchema((prev) => (ctx) => {
  const base = prev(ctx)
  return {
    ...base,
    toMarkdown: {
      match: (node) => node.type.name === 'bullet_list',
      runner: (state, node) => {
        state
          .openNode('list', void 0, { ordered: false, spread: node.attrs.spread === 'true' })
          .next(node.content)
          .closeNode()
      }
    }
  }
})

/** list_item: coerce `spread` for non-task items; task items keep gfm's runner. */
export const fixedListItemSchema = extendListItemSchemaForTask.extendSchema((prev) => (ctx) => {
  const base = prev(ctx)
  return {
    ...base,
    toMarkdown: {
      match: (node) => node.type.name === 'list_item',
      runner: (state, node) => {
        if (node.attrs.checked != null) {
          base.toMarkdown.runner(state, node)
          return
        }
        state.openNode('listItem', void 0, { spread: node.attrs.spread === 'true' }).next(node.content).closeNode()
      }
    }
  }
})

/** Both schema overrides, registered after the commonmark/gfm presets. */
export const tightListPlugins = [fixedBulletListSchema, fixedListItemSchema]
