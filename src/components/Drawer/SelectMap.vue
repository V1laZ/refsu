<template>
  <div
    class="absolute bottom-0 left-0 z-20 flex h-[70vh] w-full transform flex-col overflow-hidden rounded-t-xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur transition-transform duration-300 ease-in-out"
    :class="{
      'translate-y-0': isOpen,
      'translate-y-full': !isOpen,
    }"
    :aria-hidden="!isOpen"
    :inert="!isOpen"
  >
    <header class="flex items-center justify-between border-b border-slate-800 px-5 py-3">
      <h2 class="text-base font-semibold text-slate-100">
        Select beatmap
      </h2>
      <IconBtn
        icon="close"
        size="sm"
        @click="$emit('close')"
      />
    </header>

    <div class="flex-1 overflow-y-auto p-4 sm:p-6">
      <template v-if="!lobbyState.currentMappoolId || isChangingMappool">
        <div class="flex flex-col items-center justify-center">
          <Icon
            name="musicCollection"
            size="xl"
            class="mb-3 text-slate-600"
          />
          <p class="text-base font-medium text-slate-200">
            {{ isChangingMappool ? 'Change active mappool' : 'No active mappool selected' }}
          </p>
          <p class="mb-5 mt-1 text-sm text-slate-400">
            {{ isChangingMappool ? 'Pick a different mappool for this lobby' : 'Choose a mappool to continue' }}
          </p>
          <div class="w-full max-w-xs space-y-3">
            <Select v-model="selectedMappoolId">
              <option
                disabled
                :value="null"
              >
                Select a mappool
              </option>
              <option
                v-for="pool in mappools"
                :key="pool.id"
                :value="pool.id"
              >
                {{ pool.name }}
              </option>
            </Select>
            <Btn
              block
              variant="success"
              :disabled="!selectedMappoolId"
              @click="setActiveMappool"
            >
              Set as active
            </Btn>
            <Btn
              v-if="isChangingMappool"
              block
              variant="ghost"
              @click="cancelChangingMappool"
            >
              Cancel
            </Btn>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="mb-3 flex items-center justify-between gap-2">
          <span class="truncate text-xs text-slate-500">
            {{ currentMappoolName }}
          </span>
          <div class="flex shrink-0 items-center gap-3">
            <button
              v-if="bannedIds.length"
              type="button"
              class="text-xs text-rose-400 underline-offset-2 transition-colors hover:text-rose-300 hover:underline"
              @click="clearBans"
            >
              Clear bans
            </button>
            <button
              type="button"
              class="text-xs text-slate-500 underline-offset-2 transition-colors hover:text-slate-300 hover:underline"
              @click="startChangingMappool"
            >
              Change mappool
            </button>
          </div>
        </div>
        <List
          :beatmaps="beatmaps"
          :can-remove="false"
          bannable
          :banned-ids="bannedIds"
          @select="selectBeatmap"
          @toggle-ban="toggleBan"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import List from '@/components/Mappool/Beatmap/List.vue'
import { dbService } from '@/services/database'
import { getBannedIds, toggleBan as toggleMapBan, clearBans as clearMapBans, isBanned } from '@/stores/mapBans'
import type { LobbyState, BeatmapEntry, Mappool } from '@/types'
import IconBtn from '@/components/UI/IconBtn.vue'
import Icon from '@/components/UI/Icon.vue'
import Btn from '@/components/UI/Btn.vue'
import Select from '@/components/UI/Select.vue'

const props = defineProps<{
  isOpen: boolean
  lobbyState: LobbyState
  roomId: string
}>()

const emit = defineEmits<{
  close: []
  selectBeatmap: [beatmap: BeatmapEntry]
  setMappool: [mappoolId: number]
}>()

const mappools = ref<Mappool[]>([])
const selectedMappoolId = ref<number | null>(null)
const beatmaps = ref<BeatmapEntry[]>([])
const isChangingMappool = ref(false)

const bannedIds = computed(() => getBannedIds(props.roomId))

const currentMappoolName = computed(() => {
  const current = mappools.value.find(pool => pool.id === props.lobbyState.currentMappoolId)
  return current?.name ?? 'Active mappool'
})

const startChangingMappool = () => {
  selectedMappoolId.value = props.lobbyState.currentMappoolId
  isChangingMappool.value = true
}

const cancelChangingMappool = () => {
  isChangingMappool.value = false
}

const fetchMappools = async () => {
  try {
    mappools.value = await dbService.getMappools()
  }
  catch (error) {
    mappools.value = []
    console.error('Failed to fetch mappools:', error)
  }
}

const fetchBeatmaps = async (mappoolId: number) => {
  if (!mappoolId) return
  try {
    beatmaps.value = await dbService.getMappoolBeatmaps(mappoolId)
  }
  catch (error) {
    beatmaps.value = []
    console.error('Failed to fetch beatmaps:', error)
  }
}

const toggleBan = (beatmap: BeatmapEntry) => {
  toggleMapBan(props.roomId, beatmap.id)
}

const clearBans = () => {
  clearMapBans(props.roomId)
}

const selectBeatmap = (beatmap: BeatmapEntry) => {
  if (isBanned(props.roomId, beatmap.id)) return
  emit('selectBeatmap', beatmap)
}

const setActiveMappool = async () => {
  if (!selectedMappoolId.value || !props.lobbyState) return
  try {
    const res = await invoke<number>('set_mappool', {
      roomId: props.roomId,
      mappoolId: selectedMappoolId.value,
    })
    emit('setMappool', res)
    isChangingMappool.value = false
  }
  catch {
    alert('Failed to set mappool')
  }
}

onMounted(() => {
  fetchMappools()
})

watch(() => props.lobbyState.currentMappoolId, (newVal) => {
  if (newVal) {
    fetchBeatmaps(newVal)
    return
  }
  beatmaps.value = []
}, { immediate: true })

watch(() => props.isOpen, (open) => {
  if (!open) {
    isChangingMappool.value = false
  }
})
</script>
