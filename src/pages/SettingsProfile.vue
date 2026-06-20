<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Mobile group header -->
    <div class="flex items-center gap-3 border-b border-slate-800 bg-slate-900/60 p-4 lg:hidden">
      <IconBtn
        icon="back"
        size="sm"
        title="Back to settings"
        @click="router.push('/settings')"
      />
      <h2 class="text-base font-medium text-slate-100">
        Profile
      </h2>
    </div>

    <div class="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
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
              @click="handleLogout"
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
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { globalState } from '@/stores/global'
import { dbService } from '@/services/database'
import { confirm } from '@/composables/useConfirm'
import ConnectOsuBtn from '@/components/ConnectOsuBtn.vue'
import Btn from '@/components/UI/Btn.vue'
import Icon from '@/components/UI/Icon.vue'
import StatusDot from '@/components/UI/StatusDot.vue'
import Avatar from '@/components/UI/Avatar.vue'
import IconBtn from '@/components/UI/IconBtn.vue'

const router = useRouter()

const handleLogout = async () => {
  globalState.isLoggingOut = true
  try {
    await invoke('disconnect_from_bancho')
    globalState.user = null
    globalState.isConnected = false
    router.replace('/login')
  }
  catch (error) {
    console.error('Failed to logout:', error)
    globalState.isLoggingOut = false
  }
}

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
