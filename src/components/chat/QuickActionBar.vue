<template>
  <div class="border-b border-slate-800 bg-slate-900/60 px-3 py-2.5">
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <StatusDot
          :tone="statusDotTone"
          :pulse="room.lobbyState.matchStatus === 'active'"
        />
        <span class="text-sm hidden sm:block font-medium text-slate-200">
          {{ matchStatusText }}
        </span>
        <span
          v-if="formattedMatchTime"
          class="font-mono text-sm text-amber-300"
        >
          {{ formattedMatchTime }}
        </span>
        <span
          v-if="timerIsActive"
          class="font-mono text-sm text-pink-300"
        >
          {{ formattedTimerTime }}
        </span>
      </div>

      <div class="flex items-center gap-1.5">
        <template v-if="room.lobbyState.matchStatus === 'active'">
          <Btn
            variant="danger"
            size="sm"
            @click="handleAbort"
          >
            Abort
          </Btn>
        </template>
        <template v-else>
          <Btn
            variant="success"
            size="sm"
            :disabled="!currentMap"
            @click="emit('sendMessage', `!mp start ${lobbyState.defaultStartSeconds}`)"
          >
            Start
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            @click="emit('openSelectMap')"
          >
            Change map
          </Btn>
          <div class="relative">
            <IconBtn
              icon="timer"
              size="sm"
              :variant="timerIsActive ? 'danger' : 'ghost'"
              :title="timerIsActive ? 'Abort countdown' : 'Start countdown timer'"
              @click="handleTimerButtonClick"
            />

            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <div
                v-if="showTimerPopup"
                class="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border border-slate-800 bg-slate-900 p-3 shadow-xl"
                @click.self="showTimerPopup = false"
              >
                <p class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Countdown timer
                </p>
                <div class="mb-3 flex items-end gap-2">
                  <Field label="Minutes">
                    <Input
                      v-model.number="timerMinutes"
                      type="number"
                    />
                  </Field>
                  <span class="pb-2 text-slate-500">:</span>
                  <Field label="Seconds">
                    <Input
                      v-model.number="timerSeconds"
                      type="number"
                    />
                  </Field>
                </div>
                <Btn
                  block
                  size="sm"
                  :disabled="timerTotalSeconds <= 0"
                  @click="startTimer"
                >
                  Start timer
                </Btn>
              </div>
            </Transition>
          </div>
          <IconBtn
            icon="refresh"
            size="sm"
            title="Refresh"
            @click="emit('sendMessage', '!mp settings')"
          />
          <IconBtn
            icon="settings"
            size="sm"
            variant="ghost"
            title="Lobby settings"
            @click="showSettingsModal = true"
          />
        </template>
      </div>
    </div>

    <div
      v-if="currentMap"
      class="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-2 text-sm"
    >
      <div class="min-w-0 flex-1 truncate text-slate-200">
        <span class="font-medium">{{ currentMap.title }}</span>
        <span
          v-if="currentMap.difficulty"
          class="text-slate-400"
        > [{{ currentMap.difficulty }}]</span>
      </div>
      <div class="flex items-center gap-1">
        <Mod
          v-for="mod in room.lobbyState.selectedMods"
          :key="mod"
          :mod="mod"
        />
        <Badge
          v-if="room.lobbyState.freemod"
          tone="warning"
        >
          Freemod
        </Badge>
        <Badge
          v-else-if="room.lobbyState.selectedMods.length === 0"
          tone="neutral"
        >
          NoMod
        </Badge>
      </div>
    </div>

    <LobbySettingsModal
      v-model="showSettingsModal"
      :room="room"
      @send-message="emit('sendMessage', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Mod from '@/components/Mod.vue'
import Btn from '@/components/UI/Btn.vue'
import IconBtn from '@/components/UI/IconBtn.vue'
import Badge from '@/components/UI/Badge.vue'
import StatusDot from '@/components/UI/StatusDot.vue'
import Input from '@/components/UI/Input.vue'
import Field from '@/components/UI/Field.vue'
import LobbySettingsModal from '@/components/modals/LobbySettingsModal.vue'
import { useMatchCountdown } from '@/composables/useMatchCountdown'
import { useTimerCountdown } from '@/composables/useTimerCountdown'
import { confirm } from '@/composables/useConfirm'
import type { MultiplayerRoom } from '@/types'

const props = defineProps<{
  room: MultiplayerRoom
}>()

const emit = defineEmits<{
  openSelectMap: []
  sendMessage: [message: string]
}>()

const currentMap = computed(() => props.room.lobbyState.currentMap || null)
const lobbyState = computed(() => props.room.lobbyState)
const roomId = computed(() => props.room.id)

const { formattedTime: formattedMatchTime } = useMatchCountdown(lobbyState, roomId)
const { formattedTime: formattedTimerTime, isActive: timerIsActive } = useTimerCountdown(lobbyState)

const showSettingsModal = ref(false)
const showTimerPopup = ref(false)
const timerMinutes = ref(0)
const timerSeconds = ref(0)
const timerTotalSeconds = computed(() => timerMinutes.value * 60 + timerSeconds.value)

async function handleTimerButtonClick() {
  if (timerIsActive.value) {
    const ok = await confirm({
      title: 'Abort countdown?',
      message: 'The lobby countdown will be cancelled.',
      confirmText: 'Abort',
      tone: 'danger',
    })
    if (ok) emit('sendMessage', '!mp aborttimer')
    return
  }
  if (!showTimerPopup.value) {
    const defaultSeconds = lobbyState.value.defaultTimerSeconds
    timerMinutes.value = Math.floor(defaultSeconds / 60)
    timerSeconds.value = defaultSeconds % 60
  }
  showTimerPopup.value = !showTimerPopup.value
}

function startTimer() {
  if (timerTotalSeconds.value <= 0) return
  emit('sendMessage', `!mp timer ${timerTotalSeconds.value}`)
  showTimerPopup.value = false
}

async function handleAbort() {
  const ok = await confirm({
    title: 'Abort match?',
    message: 'The current match will be cancelled for all players.',
    confirmText: 'Abort match',
    tone: 'danger',
  })
  if (ok) emit('sendMessage', '!mp abort')
}

const matchStatusText = computed(() => {
  switch (props.room.lobbyState.matchStatus) {
    case 'active': return 'In progress'
    case 'starting': return 'Starting...'
    case 'ready': return 'Ready'
    default: return 'Idle'
  }
})

const statusDotTone = computed(() => {
  switch (props.room.lobbyState.matchStatus) {
    case 'active': return 'warning' as const
    case 'starting': return 'warning' as const
    case 'ready': return 'success' as const
    default: return 'neutral' as const
  }
})
</script>
