<template>
  <div class="flex grow flex-col overflow-hidden bg-slate-950 text-slate-100">
    <!-- Top bar -->
    <header class="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
      <IconBtn
        icon="back"
        size="sm"
        title="Back to chat"
        @click="router.replace('/')"
      />
      <div class="min-w-0">
        <h1 class="truncate text-base font-semibold text-slate-100">
          Settings
        </h1>
        <p class="hidden text-xs text-slate-400 sm:block">
          Manage your account and preferences
        </p>
      </div>
    </header>

    <div class="relative flex min-h-0 grow overflow-hidden">
      <!-- Group list -->
      <aside
        class="w-full flex-col border-r border-slate-800 bg-slate-900/40 lg:flex lg:w-64 lg:shrink-0"
        :class="hasDetail ? 'hidden lg:flex' : 'flex'"
      >
        <nav class="flex-1 space-y-1 p-3">
          <RouterLink
            v-for="group in groups"
            :key="group.path"
            :to="group.path"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            :class="route.path === group.path
              ? 'bg-pink-500/15 text-pink-300'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'"
          >
            <Icon
              :name="group.icon"
              size="sm"
            />
            {{ group.label }}
          </RouterLink>
        </nav>

        <div class="border-t border-slate-800 p-4">
          <span class="text-xs text-slate-500">Refsu v{{ appVersion }}</span>
        </div>
      </aside>

      <!-- Detail -->
      <section
        class="min-w-0 flex-1 flex-col overflow-y-auto"
        :class="hasDetail ? 'flex' : 'hidden lg:flex'"
      >
        <RouterView />

        <div
          v-if="!hasDetail"
          class="hidden flex-1 flex-col items-center justify-center p-8 text-center text-slate-500 lg:flex"
        >
          <Icon
            name="settings"
            size="xl"
            class="mb-3 text-slate-600"
          />
          <p class="text-sm">
            Select a category
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { getVersion } from '@tauri-apps/api/app'
import IconBtn from '@/components/UI/IconBtn.vue'
import Icon from '@/components/UI/Icon.vue'
import type { IconName } from '@/components/UI/icons'

const route = useRoute()
const router = useRouter()

const groups: { path: string, label: string, icon: IconName }[] = [
  { path: '/settings/profile', label: 'Profile', icon: 'user' },
  { path: '/settings/notifications', label: 'Notifications', icon: 'bell' },
]

const hasDetail = computed(() => route.matched.length > 1)

const appVersion = ref('')

onMounted(async () => {
  if (!hasDetail.value && window.matchMedia('(min-width: 1024px)').matches) {
    router.replace(groups[0].path)
  }

  try {
    appVersion.value = await getVersion()
  }
  catch (error) {
    console.error('Failed to get app version:', error)
  }
})
</script>
