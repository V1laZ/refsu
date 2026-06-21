<template>
  <div class="flex flex-1 flex-col overflow-y-auto">
    <div
      v-if="localBeatmaps.length === 0"
      class="flex h-full flex-col items-center justify-center p-8 text-slate-500"
    >
      <Icon
        name="musicCollection"
        size="xl"
        class="mb-3 text-slate-600"
      />
      <p class="text-sm">
        No beatmaps in this pool
      </p>
      <p class="mt-1 text-xs text-slate-600">
        Add some maps to get started
      </p>
    </div>

    <div
      v-else
      ref="listEl"
      class="space-y-2 p-3"
    >
      <Item
        v-for="beatmap in localBeatmaps"
        :key="beatmap.id"
        :data-id="beatmap.id"
        :beatmap="beatmap"
        :can-remove="canRemove"
        :editable="editable"
        :bannable="bannable"
        :banned="bannedIds.includes(beatmap.id)"
        @remove="removeBeatmap(beatmap.id)"
        @edit="emit('edit', beatmap)"
        @select="emit('select', beatmap)"
        @toggle-ban="emit('toggleBan', beatmap)"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import Sortable from 'sortablejs'
import Item from './Item.vue'
import Icon from '@/components/UI/Icon.vue'
import { dbService } from '@/services/database'
import { confirm } from '@/composables/useConfirm'
import type { BeatmapEntry } from '@/types'

const { beatmaps = [], canRemove = true, editable = false, bannable = false, bannedIds = [] } = defineProps<{
  beatmaps?: BeatmapEntry[]
  canRemove?: boolean
  editable?: boolean
  bannable?: boolean
  bannedIds?: number[]
}>()

const emit = defineEmits<{
  remove: [id: number]
  select: [beatmap: BeatmapEntry]
  edit: [beatmap: BeatmapEntry]
  reordered: [beatmaps: BeatmapEntry[]]
  toggleBan: [beatmap: BeatmapEntry]
}>()

const localBeatmaps = ref<BeatmapEntry[]>([])

watch(
  () => beatmaps,
  value => localBeatmaps.value = [...value],
  { immediate: true },
)

const listEl = useTemplateRef('listEl')
let sortable: Sortable | null = null

watch(listEl, (el) => {
  sortable?.destroy()
  sortable = null

  if (!el || !editable) return

  sortable = Sortable.create(el, {
    handle: '[data-drag-handle]',
    animation: 150,
    forceFallback: true,
    fallbackTolerance: 4,
    ghostClass: 'opacity-40',
    chosenClass: 'ring-2',
    onEnd: onDragEnd,
  })
}, { flush: 'post' })

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
})

const onDragEnd = async (event: Sortable.SortableEvent) => {
  const { oldIndex, newIndex } = event
  if (oldIndex == null || newIndex == null || oldIndex === newIndex) return

  const reordered = [...localBeatmaps.value]
  const [moved] = reordered.splice(oldIndex, 1)
  reordered.splice(newIndex, 0, moved)
  localBeatmaps.value = reordered

  try {
    await dbService.reorderBeatmaps(reordered.map(b => b.id))
    emit('reordered', reordered)
  }
  catch (error) {
    console.error('Failed to reorder beatmaps:', error)
  }
}

const removeBeatmap = async (beatmapId: number) => {
  const ok = await confirm({
    title: 'Remove beatmap?',
    message: 'The beatmap will be removed from this mappool.',
    confirmText: 'Remove',
    tone: 'danger',
  })
  if (!ok) return

  try {
    await dbService.deleteBeatmapFromPool(beatmapId)
    emit('remove', beatmapId)
  }
  catch (error) {
    console.error('Failed to remove beatmap:', error)
    alert('Failed to remove beatmap')
  }
}
</script>
