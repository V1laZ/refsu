<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-slate-100">
          {{ isEdit ? 'Edit beatmap' : 'Add beatmap' }}
        </h3>
        <p class="mt-0.5 text-xs text-slate-500">
          {{ isEdit ? 'Update the category and mods' : 'Paste a beatmap ID or osu! link' }}
        </p>
      </div>
      <IconBtn
        v-if="showClose !== false"
        icon="close"
        size="sm"
        title="Close"
        @click="emit('close')"
      />
    </div>

    <div
      v-if="!isEdit && !globalState.isConnectedOsu"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-slate-400"
    >
      <Icon
        name="user"
        size="xl"
        class="text-slate-600"
      />
      <p class="text-sm">
        Connect osu! to add beatmaps
      </p>
      <ConnectOsuBtn />
    </div>

    <div
      v-else
      class="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
    >
      <template v-if="!isEdit">
        <div class="flex items-center gap-2">
          <Input
            ref="beatmapInputRef"
            v-model="beatmapInput"
            data-autofocus
            placeholder="Beatmap ID or osu.ppy.sh link"
            @keyup.enter="fetchBeatmapData"
          />
          <Btn
            :disabled="!beatmapInput || isLoading"
            :loading="isLoading"
            @click="fetchBeatmapData"
          >
            Fetch
          </Btn>
        </div>

        <div
          v-if="fetchError"
          class="flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 ring-1 ring-inset ring-rose-400/30"
        >
          <Icon
            name="alert"
            size="sm"
            class="mt-0.5 shrink-0 text-rose-300"
          />
          <p class="text-sm text-rose-200">
            {{ fetchError }}
          </p>
        </div>

        <div
          v-if="addedNotice"
          class="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 ring-1 ring-inset ring-emerald-400/30"
        >
          <Icon
            name="check"
            size="sm"
            class="shrink-0 text-emerald-300"
          />
          <p class="text-sm text-emerald-200">
            {{ addedNotice }}
          </p>
        </div>
      </template>

      <template v-if="subject">
        <div class="rounded-lg border border-slate-800 bg-slate-800/50 p-3">
          <div class="flex items-center gap-3">
            <img
              v-if="subject.coverUrl"
              :src="subject.coverUrl"
              :alt="subject.title"
              class="size-14 rounded-md object-cover ring-1 ring-inset ring-slate-700"
            >
            <div
              v-else
              class="flex size-14 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-500 ring-1 ring-inset ring-slate-700"
            >
              <Icon
                name="musicCollection"
                size="md"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-slate-100">
                {{ subject.artist }} - {{ subject.title }}
              </p>
              <p class="truncate text-xs text-slate-300">
                [{{ subject.difficulty }}] by {{ subject.mapper }}
              </p>
              <div
                v-if="subject.stats"
                class="mt-1 flex items-center gap-3 text-xs text-slate-400"
              >
                <span>★{{ subject.stats.rating?.toFixed(2) }}</span>
                <span>{{ Math.floor(subject.stats.length / 60) }}:{{ String(subject.stats.length % 60).padStart(2, '0') }}</span>
                <span>{{ subject.stats.bpm }}&nbsp;BPM</span>
              </div>
              <p
                v-else
                class="mt-1 font-mono text-xs text-slate-500"
              >
                ID: {{ subject.beatmapId }}
              </p>
            </div>
          </div>
        </div>

        <Field
          label="Category"
          required
        >
          <Input
            ref="categoryRef"
            v-model="category"
            data-autofocus
            placeholder="e.g. NM2, HD1"
            @keyup.enter="submit"
          />
        </Field>

        <Field label="Mod combination">
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Mod
              v-for="mod in mods"
              :key="mod"
              class="cursor-pointer"
              :mod="mod"
              :active="computedMods.includes(mod)"
              @click="handleModSelect(mod)"
            />
          </div>
        </Field>

        <Btn
          variant="success"
          block
          :loading="isSubmitting"
          :disabled="!category"
          @click="submit"
        >
          <template #icon>
            <Icon
              :name="isEdit ? 'check' : 'plus'"
              size="sm"
            />
          </template>
          {{ isEdit ? 'Save changes' : 'Add to pool' }}
        </Btn>
      </template>

      <div
        v-else-if="!isEdit"
        class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-slate-500"
      >
        <Icon
          name="musicCollection"
          size="xl"
          class="text-slate-700"
        />
        <p class="text-xs text-slate-600">
          Fetch a beatmap to see its details here
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { dbService } from '@/services/database'
import { globalState } from '@/stores/global'
import Mod from '@/components/Mod.vue'
import Btn from '@/components/UI/Btn.vue'
import Input from '@/components/UI/Input.vue'
import Field from '@/components/UI/Field.vue'
import Icon from '@/components/UI/Icon.vue'
import IconBtn from '@/components/UI/IconBtn.vue'
import ConnectOsuBtn from '@/components/ConnectOsuBtn.vue'
import { BeatmapData, BeatmapEntry } from '@/types'

const props = defineProps<{
  mappoolId: number
  beatmap?: BeatmapEntry | null
  showClose?: boolean
}>()

const emit = defineEmits<{
  added: []
  saved: []
  close: []
}>()

const beatmapInputRef = useTemplateRef('beatmapInputRef')
const categoryRef = useTemplateRef('categoryRef')

const mods = ['NF', 'HD', 'HR', 'DT', 'EZ', 'FL', 'HT', 'FM']
const selectedMods = ref<string[]>(['NF'])
const beatmapPreview = ref<BeatmapData | null>(null)
const beatmapInput = ref('')
const category = ref('')
const isLoading = ref(false)
const isSubmitting = ref(false)
const fetchError = ref('')
const addedNotice = ref('')

const isEdit = computed(() => !!props.beatmap)

const computedMods = computed(() => {
  if (selectedMods.value.includes('FM')) {
    return selectedMods.value.filter(m => ['FM', 'DT', 'HT'].includes(m))
  }
  return selectedMods.value
})

const subject = computed(() => {
  if (isEdit.value && props.beatmap) {
    return {
      artist: props.beatmap.artist,
      title: props.beatmap.title,
      difficulty: props.beatmap.difficulty,
      mapper: props.beatmap.mapper,
      beatmapId: props.beatmap.beatmap_id,
      coverUrl: null as string | null,
      stats: null as { rating: number, length: number, bpm: number } | null,
    }
  }
  if (beatmapPreview.value) {
    const p = beatmapPreview.value
    return {
      artist: p.artist,
      title: p.title,
      difficulty: p.difficulty,
      mapper: p.mapper,
      beatmapId: p.id,
      coverUrl: `https://assets.ppy.sh/beatmaps/${p.beatmapset_id}/covers/cover.jpg`,
      stats: { rating: p.difficulty_rating, length: p.total_length, bpm: p.bpm },
    }
  }
  return null
})

const parseMods = (value?: string): string[] => {
  if (!value) return []
  return value.match(/.{1,2}/g) || []
}

const resetAddForm = () => {
  beatmapPreview.value = null
  beatmapInput.value = ''
  category.value = ''
  selectedMods.value = ['NF']
  fetchError.value = ''
}

watch(
  () => props.beatmap,
  (entry) => {
    if (entry) {
      category.value = entry.category ?? ''
      selectedMods.value = parseMods(entry.mod_combination)
    }
    else {
      resetAddForm()
    }
    fetchError.value = ''
    addedNotice.value = ''
  },
  { immediate: true },
)

const focusActiveField = () => {
  nextTick(() => {
    const target = isEdit.value ? categoryRef : beatmapInputRef
    target.value?.focus()
  })
}

const fetchBeatmapData = async () => {
  if (!globalState.user) return

  const beatmapId = extractBeatmapId(beatmapInput.value)
  if (!beatmapId) {
    fetchError.value = 'Invalid beatmap ID or URL format'
    return
  }

  isLoading.value = true
  fetchError.value = ''
  addedNotice.value = ''

  try {
    const accessToken = await dbService.getAccessToken(globalState.user || '')
    const data = await invoke<BeatmapData>('fetch_beatmap_data', {
      beatmapId: beatmapId,
      accessToken,
    })

    beatmapPreview.value = data
  }
  catch (error) {
    console.error('Failed to fetch beatmap data:', error)
    fetchError.value = error instanceof Error ? error.message : 'Failed to fetch beatmap data'
  }
  finally {
    isLoading.value = false
  }
}

const handleModSelect = (mod: string) => {
  if (selectedMods.value.includes(mod)) {
    selectedMods.value = selectedMods.value.filter(m => m !== mod)
    return
  }

  selectedMods.value.push(mod)

  switch (mod) {
    case 'FM':
      selectedMods.value = selectedMods.value.filter(m => ['FM', 'DT', 'HT'].includes(m))
      break
    case 'DT':
      selectedMods.value = selectedMods.value.filter(m => m !== 'HT')
      break
    case 'HT':
      selectedMods.value = selectedMods.value.filter(m => m !== 'DT')
      break
    case 'HR':
      selectedMods.value = selectedMods.value.filter(m => m !== 'EZ' && m !== 'FM')
      break
    case 'EZ':
      selectedMods.value = selectedMods.value.filter(m => m !== 'HR' && m !== 'FM')
      break
    default:
      selectedMods.value = selectedMods.value.filter(m => m !== 'FM')
  }
}

const extractBeatmapId = (input: string): string | null => {
  const urlPatterns = [
    /osu\.ppy\.sh\/beatmapsets\/\d+#\w+\/(\d+)/,
    /osu\.ppy\.sh\/b\/(\d+)/,
    /osu\.ppy\.sh\/beatmaps\/(\d+)/,
  ]

  for (const pattern of urlPatterns) {
    const match = input.match(pattern)
    if (match) return match[1]
  }

  if (/^\d+$/.test(input.trim())) {
    return input.trim()
  }

  return null
}

const submit = async () => {
  if (!subject.value || !category.value.trim()) return

  const normalizedCategory = category.value.trim().toUpperCase()
  const modCombination = computedMods.value.join('')

  isSubmitting.value = true
  try {
    if (isEdit.value && props.beatmap) {
      await dbService.updateBeatmapInPool(props.beatmap.id, normalizedCategory, modCombination)
      emit('saved')
    }
    else if (beatmapPreview.value) {
      const label = `${beatmapPreview.value.artist} - ${beatmapPreview.value.title}`
      await dbService.addBeatmapToPool(
        props.mappoolId,
        beatmapPreview.value.id,
        beatmapPreview.value.artist,
        beatmapPreview.value.title,
        beatmapPreview.value.difficulty,
        beatmapPreview.value.mapper,
        modCombination,
        normalizedCategory,
      )
      emit('added')
      resetAddForm()
      addedNotice.value = `Added ${label}`
      focusActiveField()
    }
  }
  catch (error) {
    console.error('Failed to save beatmap:', error)
    fetchError.value = error instanceof Error ? error.message : 'Failed to save beatmap'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>
