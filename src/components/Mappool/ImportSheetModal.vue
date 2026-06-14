<template>
  <Modal
    v-model="open"
    size="lg"
    scroll
    wrapper-class="max-h-[85vh]"
  >
    <template #header>
      <h2 class="text-lg font-semibold text-slate-100">
        Import from Google Sheets
      </h2>
      <p class="mt-0.5 text-sm text-slate-400">
        Paste a public mappool sheet link and pick a round to import
      </p>
    </template>

    <!-- Step 1: URL input -->
    <div
      v-if="!rounds.length"
      class="space-y-4"
    >
      <Field
        label="Google Sheets link"
        hint="The sheet must be shared as “Anyone with the link can view”."
      >
        <Input
          v-model="url"
          data-autofocus
          placeholder="https://docs.google.com/spreadsheets/d/…"
          @keyup.enter="fetchSheet"
        />
      </Field>

      <label class="flex items-center justify-between gap-3">
        <span class="min-w-0">
          <span class="block text-sm text-slate-200">Force <span class="font-medium">NF</span> on every map</span>
        </span>
        <Switch v-model="forceNf" />
      </label>

      <div
        v-if="error"
        class="flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 ring-1 ring-inset ring-rose-400/30"
      >
        <Icon
          name="alert"
          size="sm"
          class="mt-0.5 flex-shrink-0 text-rose-300"
        />
        <p class="text-sm text-rose-200">
          {{ error }}
        </p>
      </div>

      <Btn
        block
        :loading="loading"
        :disabled="!url.trim()"
        @click="fetchSheet"
      >
        <template #icon>
          <Icon
            name="download"
            size="sm"
          />
        </template>
        Read sheet
      </Btn>
    </div>

    <!-- Step 2: review & import -->
    <div
      v-else
      class="space-y-4"
    >
      <Field
        v-if="rounds.length > 1"
        label="Round"
      >
        <Select
          v-model="selectedIndex"
        >
          <option
            v-for="(round, index) in rounds"
            :key="index"
            :value="index"
          >
            {{ round.name }} ({{ round.entries.length }} maps)
          </option>
        </Select>
      </Field>

      <Field
        label="Mappool name"
        required
      >
        <Input
          v-model="name"
          placeholder="Mappool name"
        />
      </Field>

      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>{{ selectedRound.entries.length }} maps</span>
        <span
          v-if="reviewCount"
          class="text-amber-300"
        >{{ reviewCount }} need review</span>
      </div>

      <div class="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-2">
        <div
          v-for="(entry, index) in previewEntries"
          :key="index"
          class="flex items-center gap-2 rounded-md px-2 py-1.5"
          :class="entry.needsReview ? 'bg-amber-500/5' : ''"
        >
          <Badge :tone="categoryTone(entry.category)">
            {{ entry.category }}
          </Badge>
          <Badge
            v-if="entry.mods"
            tone="accent"
          >
            +{{ entry.mods }}
          </Badge>
          <span class="min-w-0 flex-1 truncate text-sm text-slate-200">
            <template v-if="entry.title">{{ entry.artist }} - {{ entry.title }}</template>
            <span
              v-else
              class="text-slate-500"
            >Unknown map · ID {{ entry.beatmapId }}</span>
          </span>
          <Icon
            v-if="entry.needsReview"
            name="alert"
            size="sm"
            class="flex-shrink-0 text-amber-300"
            title="Could not load this beatmap automatically"
          />
        </div>
      </div>

      <div
        v-if="error"
        class="flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 ring-1 ring-inset ring-rose-400/30"
      >
        <Icon
          name="alert"
          size="sm"
          class="mt-0.5 flex-shrink-0 text-rose-300"
        />
        <p class="text-sm text-rose-200">
          {{ error }}
        </p>
      </div>

      <div class="flex gap-2">
        <Btn
          variant="ghost"
          block
          @click="reset"
        >
          Back
        </Btn>
        <Btn
          variant="success"
          block
          :loading="importing"
          :disabled="!name.trim() || !selectedRound.entries.length"
          @click="doImport"
        >
          <template #icon>
            <Icon
              name="plus"
              size="sm"
            />
          </template>
          Import {{ selectedRound.entries.length }} maps
        </Btn>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { dbService } from '@/services/database'
import { extractMappoolFromSheet } from '@/services/sheetImport'
import { globalState } from '@/stores/global'
import Modal from '@/components/UI/Modal.vue'
import Input from '@/components/UI/Input.vue'
import Field from '@/components/UI/Field.vue'
import Btn from '@/components/UI/Btn.vue'
import Select from '@/components/UI/Select.vue'
import Badge from '@/components/UI/Badge.vue'
import Icon from '@/components/UI/Icon.vue'
import Switch from '@/components/UI/Switch.vue'
import { useCategoryTone } from '@/composables/useCategoryTone'
import type { ExtractedRound } from '@/types'

const open = defineModel<boolean>({ default: false })

const { categoryTone } = useCategoryTone()

const emit = defineEmits<{
  imported: [id: number]
}>()

const url = ref('')
const loading = ref(false)
const importing = ref(false)
const error = ref('')
const rounds = ref<ExtractedRound[]>([])
const sheetTitle = ref<string | null>(null)
const selectedIndex = ref(0)
const name = ref('')
const forceNf = ref(true)

const selectedRound = computed(() => rounds.value[selectedIndex.value] ?? { name: '', entries: [] })
const reviewCount = computed(() => selectedRound.value.entries.filter(e => e.needsReview).length)

const withNf = (mods: string) => {
  if (!forceNf.value) return mods
  return mods.includes('NF') ? mods : `NF${mods}`
}

const previewEntries = computed(() =>
  selectedRound.value.entries.map(e => ({ ...e, mods: withNf(e.mods) })),
)

// Tournament mappool names are usually "<sheet name> - <stage>". Strip the
// generic "… main sheet / mappool / pool" wording from the workbook title and
// combine it with the round name to suggest a default.
const cleanSheetTitle = (title: string) => {
  const noise = /\s*[-–—|:(]*\s*(main\s+sheet|mappool\s+sheet|pool\s+sheet|spread\s*sheet|mappools?|sheets?|pools?)\s*[)\]]*\s*$/i
  let t = title.trim()
  let prev = ''
  while (t && t !== prev) {
    prev = t
    t = t.replace(noise, '').trim()
  }
  return t
}

const defaultName = (roundName: string) => {
  const base = sheetTitle.value ? cleanSheetTitle(sheetTitle.value) : ''
  return base ? `${base} - ${roundName}` : roundName
}

watch(open, (isOpen) => {
  if (isOpen) {
    reset()
    forceNf.value = true
  }
})

watch(selectedIndex, () => {
  name.value = defaultName(selectedRound.value.name)
})

function reset() {
  url.value = ''
  error.value = ''
  rounds.value = []
  sheetTitle.value = null
  selectedIndex.value = 0
  name.value = ''
}

const fetchSheet = async () => {
  if (!url.value.trim()) return

  loading.value = true
  error.value = ''
  try {
    const accessToken = await dbService.getAccessToken(globalState.user ?? '')
    if (!accessToken) {
      error.value = 'Connect your osu! account to import from a sheet.'
      return
    }
    const result = await extractMappoolFromSheet(url.value.trim(), accessToken)
    if (!result.rounds.length) {
      error.value = 'No mappool could be detected in that sheet.'
      return
    }
    rounds.value = result.rounds
    sheetTitle.value = result.sheetTitle
    selectedIndex.value = 0
    name.value = defaultName(result.rounds[0].name)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to read the sheet'
  }
  finally {
    loading.value = false
  }
}

const doImport = async () => {
  if (!name.value.trim() || !previewEntries.value.length) return

  importing.value = true
  error.value = ''
  try {
    const id = await dbService.importMappool(
      name.value.trim(),
      previewEntries.value.map(e => ({
        beatmapId: e.beatmapId,
        artist: e.artist,
        title: e.title,
        difficulty: e.difficulty,
        mapper: e.mapper,
        mods: e.mods,
        category: e.category,
      })),
    )
    emit('imported', id)
    open.value = false
  }
  catch (err) {
    console.error('Failed to import mappool:', err)
    error.value = err instanceof Error ? err.message : 'Failed to import mappool'
  }
  finally {
    importing.value = false
  }
}
</script>
