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
        Appearance
      </h2>
    </div>

    <div class="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <section>
        <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Chat
        </h3>
        <div class="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <span class="text-sm font-medium text-slate-100">Compact mode</span>
              <p class="mt-0.5 text-xs text-slate-500">
                Hide avatars in chat for a denser layout.
              </p>
            </div>
            <Switch v-model="appearanceSettings.compactMode" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Switch from '@/components/UI/Switch.vue'
import IconBtn from '@/components/UI/IconBtn.vue'
import { appearanceSettings } from '@/stores/settings'

const router = useRouter()
</script>
