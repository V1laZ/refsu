<template>
  <Modal
    v-model="open"
    title="Lobby settings"
    size="md"
  >
    <form
      id="lobbySettingsForm"
      class="space-y-4"
      @submit.prevent="handleSave"
    >
      <Field label="Game name">
        <Input
          ref="gameNameInputRef"
          v-model="gameName"
          placeholder="Enter game name"
          :maxlength="50"
        />
      </Field>

      <Field label="Team mode">
        <Select v-model="teamMode">
          <option value="0">
            Head to head
          </option>
          <option value="1">
            Tag coop
          </option>
          <option value="2">
            Team vs
          </option>
          <option value="3">
            Tag team vs
          </option>
        </Select>
      </Field>

      <Field label="Win condition">
        <Select v-model="winCondition">
          <option value="0">
            Score
          </option>
          <option value="1">
            Accuracy
          </option>
          <option value="2">
            Combo
          </option>
          <option value="3">
            Score V2
          </option>
        </Select>
      </Field>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Default start
          </p>
          <div class="flex items-end gap-2">
            <Field label="Min">
              <Input
                v-model.number="startMinutes"
                type="number"
              />
            </Field>
            <span class="pb-2 text-slate-500">:</span>
            <Field label="Sec">
              <Input
                v-model.number="startSeconds"
                type="number"
              />
            </Field>
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Default timer
          </p>
          <div class="flex items-end gap-2">
            <Field label="Min">
              <Input
                v-model.number="timerMinutes"
                type="number"
              />
            </Field>
            <span class="pb-2 text-slate-500">:</span>
            <Field label="Sec">
              <Input
                v-model.number="timerSeconds"
                type="number"
              />
            </Field>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <Btn
        variant="ghost"
        @click="open = false"
      >
        Cancel
      </Btn>
      <Btn
        form="lobbySettingsForm"
        type="submit"
        :loading="loading"
      >
        Save
      </Btn>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import Modal from '@/components/UI/Modal.vue'
import Btn from '@/components/UI/Btn.vue'
import Input from '@/components/UI/Input.vue'
import Select from '@/components/UI/Select.vue'
import Field from '@/components/UI/Field.vue'
import type { MultiplayerRoom, LobbySettings } from '@/types'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  room: MultiplayerRoom
}>()

const emit = defineEmits<{
  sendMessage: [message: string]
}>()

// osu! `!mp set <teammode> <wincondition>` use numeric codes; LobbySettings stores names.
const TEAM_MODE_TO_CODE: Record<LobbySettings['teamMode'], string> = {
  HeadToHead: '0',
  TagCoop: '1',
  TeamVs: '2',
  TagTeamVs: '3',
}
const WIN_CONDITION_TO_CODE: Record<LobbySettings['winCondition'], string> = {
  Score: '0',
  Accuracy: '1',
  Combo: '2',
  ScoreV2: '3',
}

// Team vs ('2') and Tag team vs ('3') assign players to red/blue teams; the others don't.
const usesTeams = (teamModeCode: string) => teamModeCode === '2' || teamModeCode === '3'

const loading = ref(false)
const gameName = ref('')
const teamMode = ref('0')
const winCondition = ref('0')
const timerMinutes = ref(0)
const timerSeconds = ref(0)
const startMinutes = ref(0)
const startSeconds = ref(0)

const gameNameInputRef = useTemplateRef<{ focus: () => void }>('gameNameInputRef')

// Snapshot of the values loaded into the form, so we only send IRC commands for changes.
let initialGameName = ''
let initialTeamMode = '0'
let initialWinCondition = '0'

function loadFromState() {
  const { settings, defaultTimerSeconds, defaultStartSeconds } = props.room.lobbyState

  gameName.value = settings?.roomName ?? ''
  teamMode.value = settings ? TEAM_MODE_TO_CODE[settings.teamMode] : '0'
  winCondition.value = settings ? WIN_CONDITION_TO_CODE[settings.winCondition] : '0'

  timerMinutes.value = Math.floor(defaultTimerSeconds / 60)
  timerSeconds.value = defaultTimerSeconds % 60
  startMinutes.value = Math.floor(defaultStartSeconds / 60)
  startSeconds.value = defaultStartSeconds % 60

  initialGameName = gameName.value
  initialTeamMode = teamMode.value
  initialWinCondition = winCondition.value
}

const handleSave = async () => {
  loading.value = true

  try {
    const name = gameName.value.trim()
    if (name && name !== initialGameName) {
      emit('sendMessage', `!mp name ${name}`)
    }

    if (teamMode.value !== initialTeamMode || winCondition.value !== initialWinCondition) {
      emit('sendMessage', `!mp set ${teamMode.value} ${winCondition.value}`)

      // Switching between a team-based mode (Team vs / Tag team vs) and a
      // non-team mode (Head to head / Tag coop) reassigns player team colors,
      // so refresh the lobby state to pick them up.
      if (usesTeams(teamMode.value) !== usesTeams(initialTeamMode)) {
        emit('sendMessage', '!mp settings')
      }
    }

    const timerTotal = Math.max(0, timerMinutes.value * 60 + timerSeconds.value)
    const startTotal = Math.max(0, startMinutes.value * 60 + startSeconds.value)

    await invoke('set_lobby_command_defaults', {
      roomId: props.room.id,
      timerSeconds: timerTotal,
      startSeconds: startTotal,
    })

    open.value = false
  }
  catch (error) {
    console.error('Failed to save lobby settings:', error)
  }
  finally {
    loading.value = false
  }
}

watch(open, (newValue) => {
  if (newValue) {
    loadFromState()
    nextTick(() => gameNameInputRef.value?.focus())
  }
}, { immediate: true, flush: 'post' })
</script>
