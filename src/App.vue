<template>
  <div
    class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100"
    style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);"
  >
    <TitleBar v-if="showTitleBar" />

    <main class="flex grow flex-col overflow-hidden">
      <div
        v-if="loading"
        class="flex grow items-center justify-center px-6"
      >
        <div class="flex max-w-sm flex-col items-center text-center">
          <Spinner class="mb-5 size-10 text-pink-300" />
          <h2 class="mb-1 text-xl font-semibold text-slate-100">
            Refsu
          </h2>
          <p class="text-sm text-slate-400">
            {{ loadingMessage }}
          </p>
          <p
            v-if="errorMessage"
            class="mt-3 text-sm text-rose-300"
          >
            {{ errorMessage }}
          </p>
        </div>
      </div>

      <div
        v-else-if="disconnected"
        class="flex grow items-center justify-center px-6"
      >
        <div class="flex max-w-sm flex-col items-center text-center">
          <div class="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/30">
            <Icon
              name="alert"
              size="lg"
            />
          </div>
          <h2 class="mb-2 text-xl font-semibold text-slate-100">
            Disconnected from Bancho
          </h2>
          <p class="mb-5 text-sm text-slate-400">
            You have been disconnected. Check your connection and try again.
          </p>
          <Btn @click="reconnectToBancho">
            Reconnect
          </Btn>
          <p
            v-if="errorMessage"
            class="mt-3 text-sm text-rose-300"
          >
            {{ errorMessage }}
          </p>
        </div>
      </div>

      <RouterView
        v-else
        v-slot="{ Component, route }"
      >
        <Transition
          :name="route.meta.transition || 'fade'"
          mode="out-in"
        >
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <OAuthCallback v-if="modalsState.showOAuthCallback" />

    <ConfirmDialog />

    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <UpdateToast
        v-if="updateInfo"
        :update-info="updateInfo"
        @close="updateInfo = null"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { RouterView, useRouter } from 'vue-router'
import { dbService } from './services/database'
import { globalState } from './stores/global'
import { type UnlistenFn, listen } from '@tauri-apps/api/event'
import OAuthCallback from './components/modals/OAuthCallback.vue'
import UpdateToast from './components/UI/UpdateToast.vue'
import Spinner from './components/UI/Spinner.vue'
import TitleBar from './components/UI/TitleBar.vue'
import Btn from './components/UI/Btn.vue'
import Icon from './components/UI/Icon.vue'
import ConfirmDialog from './components/UI/ConfirmDialog.vue'
import { modalsState } from './stores/global'
import { UpdateInfo, UserCredentials } from '@/types'
import { platform } from '@tauri-apps/plugin-os'
import { useAndroidBackButton } from './composables/useAndroidBackButton'

const router = useRouter()
const currentPlatform = platform()
const showTitleBar = currentPlatform !== 'ios' && currentPlatform !== 'android'

useAndroidBackButton()

if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--title-bar-h', showTitleBar ? '2rem' : '0px')
}

const loading = ref(true)
const disconnected = ref(false)
const loadingMessage = ref('Loading...')
const errorMessage = ref('')
const isAuthenticated = ref(true)
const updateInfo = ref<UpdateInfo | null>(null)

let unlistenDisconnect: UnlistenFn | null = null
let unlistenIsAuthenticated: UnlistenFn | null = null

async function connectWithCredentials(saved: UserCredentials) {
  globalState.user = saved.username
  globalState.userId = saved.id
  globalState.isLoggingOut = false
  globalState.isConnectedOsu = await dbService.getOsuConnectedStatus(saved.username)
  try {
    loadingMessage.value = 'Connecting...'
    errorMessage.value = ''
    const connected = await invoke<boolean>('get_connection_status')
    if (connected) {
      globalState.isConnected = true
      loading.value = false
      disconnected.value = false
      router.replace('/')
      return true
    }
    const config = {
      username: saved.username,
      password: saved.password,
    }
    await invoke('connect_to_bancho', { config })
    globalState.isConnected = true
    loading.value = false
    disconnected.value = false
    router.replace('/')
    return true
  }
  catch (error) {
    errorMessage.value = 'Failed to connect with saved credentials.' + (error instanceof Error ? ' ' + error.message : error ? ' ' + String(error) : '')
    console.error('Failed to connect with saved credentials:', error)
    return false
  }
}

async function reconnectToBancho() {
  errorMessage.value = ''
  try {
    loading.value = true
    loadingMessage.value = 'Reconnecting to Bancho...'
    await invoke('reconnect_to_bancho')
    globalState.isConnected = true
    disconnected.value = false
    loading.value = false
    router.replace('/')
  }
  catch {
    errorMessage.value = 'Failed to reconnect to Bancho. Please try to restart the app.'
  }
}

function handleIsAuthenticated(isAuth: boolean) {
  isAuthenticated.value = isAuth
  if (isAuth) return
  return router.replace('/login')
}

function handleOfflineState() {
  globalState.isConnected = false
  loading.value = false
  loadingMessage.value = ''
  errorMessage.value = ''

  if (!isAuthenticated.value || globalState.isLoggingOut) {
    disconnected.value = false
    return
  }

  disconnected.value = true
}

async function checkForUpdates() {
  try {
    const result = await invoke<UpdateInfo>('check_for_updates')

    if (result) {
      updateInfo.value = result
    }
  }
  catch (error) {
    console.log('Update check failed:', error)
  }
}

onMounted(async () => {
  unlistenDisconnect = await listen('irc-disconnected', handleOfflineState)
  unlistenIsAuthenticated = await listen<boolean>('is-authenticated', ({ payload }) => {
    handleIsAuthenticated(payload)
  })

  loading.value = true
  try {
    loadingMessage.value = 'Initializing...'
    errorMessage.value = ''
    await dbService.init()
    loadingMessage.value = 'Checking credentials...'
    const saved = await dbService.getCredentials()
    if (saved) {
      await connectWithCredentials(saved)
    }
    else {
      loading.value = false
      router.replace('/login')
    }

    setTimeout(() => {
      checkForUpdates()
    }, 1000)
  }
  catch (error) {
    errorMessage.value = 'Failed to initialize database.' + (error instanceof Error ? ' ' + error.message : error ? ' ' + String(error) : '')
    console.error('Failed to initialize database:', error)
    return
  }
})

onUnmounted(() => {
  if (unlistenDisconnect) unlistenDisconnect()
  if (unlistenIsAuthenticated) unlistenIsAuthenticated()
})
</script>
