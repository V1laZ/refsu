<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <template v-if="pool">
      <div class="flex items-start gap-3 border-b border-slate-800 bg-slate-900/60 p-4">
        <IconBtn
          icon="back"
          size="sm"
          class="lg:hidden"
          title="Back to mappools"
          @click="router.back()"
        />
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-base font-medium text-slate-100">
            {{ pool.name }}
          </h2>
          <p
            v-if="pool.description"
            class="mt-0.5 truncate text-sm text-slate-400"
          >
            {{ pool.description }}
          </p>
          <span class="mt-1 block text-xs text-slate-500">{{ beatmaps.length }} maps</span>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <Btn
            variant="success"
            size="sm"
            class="gap-0! sm:gap-2"
            :class="{ 'ring-2 ring-emerald-400/50': panelOpen && !panelBeatmap }"
            @click="openAdd"
          >
            <template #icon>
              <Icon
                name="plus"
                size="sm"
              />
            </template>
            <span class="hidden sm:inline">Add beatmap</span>
          </Btn>
          <IconBtn
            icon="edit"
            variant="accent"
            size="sm"
            title="Edit mappool"
            @click="poolFormOpen = true"
          />
          <IconBtn
            icon="trash"
            variant="danger"
            size="sm"
            title="Delete mappool"
            @click="deletePool"
          />
        </div>
      </div>

      <BeatmapList
        class="flex-1"
        :beatmaps="beatmaps"
        editable
        @remove="onRemove"
        @edit="openEdit"
        @reordered="beatmaps = $event"
      />
    </template>

    <!-- Desktop add/edit slideover -->
    <SlideOver
      v-if="isDesktop"
      v-model="panelOpen"
      class="hidden lg:block"
    >
      <BeatmapPanel
        v-if="pool"
        :mappool-id="pool.id"
        :beatmap="panelBeatmap"
        @added="refreshBeatmaps"
        @saved="onSaved"
        @close="closePanel"
      />
    </SlideOver>

    <!-- Mobile add/edit bottom sheet -->
    <BottomSheet
      v-else
      v-model="panelOpen"
      class="lg:hidden"
      :autofocus="false"
    >
      <BeatmapPanel
        v-if="pool"
        :mappool-id="pool.id"
        :beatmap="panelBeatmap"
        :show-close="false"
        @added="refreshBeatmaps"
        @saved="onSaved"
        @close="closePanel"
      />
    </BottomSheet>

    <MappoolFormModal
      v-model="poolFormOpen"
      :mappool="pool"
      @updated="loadMappools"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { dbService } from '@/services/database'
import { confirm } from '@/composables/useConfirm'
import { useMappools } from '@/composables/useMappools'
import BeatmapList from '@/components/Mappool/Beatmap/List.vue'
import BeatmapPanel from '@/components/Mappool/BeatmapPanel.vue'
import MappoolFormModal from '@/components/Mappool/MappoolFormModal.vue'
import BottomSheet from '@/components/UI/BottomSheet.vue'
import SlideOver from '@/components/UI/SlideOver.vue'
import IconBtn from '@/components/UI/IconBtn.vue'
import Icon from '@/components/UI/Icon.vue'
import Btn from '@/components/UI/Btn.vue'
import type { BeatmapEntry } from '@/types'
import { useMediaQuery } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const { mappools, loadMappools } = useMappools()

const beatmaps = ref<BeatmapEntry[]>([])
const panelOpen = ref(false)
const panelBeatmap = ref<BeatmapEntry | null>(null)
const poolFormOpen = ref(false)

const isDesktop = useMediaQuery('(min-width: 1024px)')

const poolId = computed(() => Number(route.params.id))
const pool = computed(() => mappools.value.find(p => p.id === poolId.value) ?? null)

async function refreshBeatmaps() {
  if (!Number.isFinite(poolId.value)) return
  try {
    beatmaps.value = await dbService.getMappoolBeatmaps(poolId.value)
  }
  catch (error) {
    console.error('Failed to load beatmaps:', error)
    beatmaps.value = []
  }
}

onMounted(async () => {
  if (!mappools.value.length) await loadMappools()
  if (!pool.value) {
    router.replace('/mappools')
    return
  }
  await refreshBeatmaps()
})

watch(poolId, async () => {
  closePanel()
  await refreshBeatmaps()
})

function openAdd() {
  panelBeatmap.value = null
  panelOpen.value = true
}

function openEdit(beatmap: BeatmapEntry) {
  panelBeatmap.value = beatmap
  panelOpen.value = true
}

function closePanel() {
  panelOpen.value = false
}

function onSaved() {
  closePanel()
  refreshBeatmaps()
}

function onRemove(id: number) {
  if (panelBeatmap.value?.id === id) closePanel()
  refreshBeatmaps()
}

async function deletePool() {
  if (!pool.value) return

  const ok = await confirm({
    title: 'Delete mappool?',
    message: 'This action cannot be undone.',
    confirmText: 'Delete',
    tone: 'danger',
  })
  if (!ok) return

  try {
    await dbService.deleteMappool(pool.value.id)
    await loadMappools()
    router.push('/mappools')
  }
  catch (error) {
    console.error('Failed to delete mappool:', error)
    alert('Failed to delete mappool')
  }
}
</script>
