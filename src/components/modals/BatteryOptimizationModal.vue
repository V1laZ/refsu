<template>
  <Modal
    v-model="open"
    title="Allow Refsu to run in the background"
    size="sm"
  >
    <div class="space-y-4">
      <p class="text-sm text-slate-300">
        Without disabling battery optimization, Refsu won't work properly and you'll
        keep disconnecting from Bancho.
      </p>
    </div>

    <template #footer>
      <Btn
        variant="ghost"
        @click="open = false"
      >
        Later
      </Btn>
      <Btn
        :loading="opening"
        @click="openSettings"
      >
        <template #icon>
          <Icon name="external" />
        </template>
        Open battery settings
      </Btn>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { checkBatteryOptimizationStatus, openBatterySettings as openBatterySettingsPage } from 'tauri-plugin-android-battery-optimization-api'
import Modal from '@/components/UI/Modal.vue'
import Btn from '@/components/UI/Btn.vue'
import Icon from '@/components/UI/Icon.vue'

const open = defineModel<boolean>({ required: true })

const opening = ref(false)

async function openSettings() {
  opening.value = true
  try {
    await openBatterySettingsPage()
  }
  catch (error) {
    console.error('Failed to open battery optimization settings:', error)
  }
  finally {
    opening.value = false
  }
}

async function recheckOnReturn() {
  if (document.visibilityState !== 'visible' || !open.value) return
  try {
    const status = await checkBatteryOptimizationStatus()
    if (status.isIgnoringOptimizations) open.value = false
  }
  catch (error) {
    console.error('Failed to re-check battery optimization status:', error)
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', recheckOnReturn)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', recheckOnReturn)
})
</script>
