<template>
  <Modal
    v-model="open"
    title="Settings"
    size="md"
  >
    <div class="space-y-6">
      <section>
        <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Account
        </h3>
        <div class="space-y-3">
          <div class="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
            <div class="flex items-center gap-3">
              <Avatar
                :username="globalState.user ?? ''"
                size="lg"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-slate-100">
                  {{ globalState.user || 'Not logged in' }}
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <StatusDot :tone="globalState.isConnected ? 'success' : 'danger'" />
                  <span class="text-sm text-slate-400">
                    {{ globalState.isConnected ? 'Connected to Bancho' : 'Offline' }}
                  </span>
                </div>
                <button
                  type="button"
                  :class="[
                    'mt-1 flex items-center gap-2 text-sm transition-colors',
                    globalState.isConnectedOsu ? 'cursor-pointer text-slate-400 hover:text-rose-300' : 'cursor-default text-slate-400',
                  ]"
                  @click="removeOsuConnect"
                >
                  <StatusDot :tone="globalState.isConnectedOsu ? 'success' : 'danger'" />
                  <span>
                    {{ globalState.isConnectedOsu ? 'osu! account connected' : 'osu! account not connected' }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <ConnectOsuBtn v-if="!globalState.isConnectedOsu" />

            <Btn
              variant="danger"
              block
              @click="emit('logout')"
            >
              <template #icon>
                <Icon
                  name="logout"
                  size="sm"
                />
              </template>
              Logout
            </Btn>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <span class="text-xs text-slate-500">Refsu v{{ appVersion }}</span>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { globalState } from '@/stores/global'
import ConnectOsuBtn from '../ConnectOsuBtn.vue'
import { dbService } from '@/services/database'
import Modal from '@/components/UI/Modal.vue'
import Btn from '@/components/UI/Btn.vue'
import Icon from '@/components/UI/Icon.vue'
import StatusDot from '@/components/UI/StatusDot.vue'
import Avatar from '@/components/UI/Avatar.vue'
import { confirm } from '@/composables/useConfirm'

const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  logout: []
}>()

const appVersion = ref('')

onMounted(async () => {
  try {
    appVersion.value = await getVersion()
  }
  catch (error) {
    console.error('Failed to get app version:', error)
  }
})

const removeOsuConnect = async () => {
  if (!globalState.user || !globalState.isConnectedOsu) return
  try {
    const ok = await confirm({
      title: 'Disconnect osu! account?',
      message: 'You will need to reconnect to fetch beatmap and player data.',
      confirmText: 'Disconnect',
      tone: 'danger',
    })
    if (!ok) return
    dbService.deleteOauthToken(globalState.user)
    globalState.isConnectedOsu = false
  }
  catch (error) {
    console.error('Error removing osu! connection:', error)
  }
}
</script>
