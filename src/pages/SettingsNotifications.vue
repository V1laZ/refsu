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
        Notifications
      </h2>
    </div>

    <div class="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <section>
        <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          System notifications
        </h3>
        <div class="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <span class="text-sm font-medium text-slate-100">Show notifications</span>
              <p class="mt-0.5 text-xs text-slate-500">
                Notify me about mentions and PMs while the app is in the background.
              </p>
            </div>
            <Switch v-model="notificationSettings.enabled" />
          </div>
        </div>
      </section>

      <section>
        <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Sounds
        </h3>
        <div class="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-slate-100">Sound effects</span>
            <Switch v-model="soundSettings.enabled" />
          </div>

          <div
            class="mt-4 space-y-4 transition-opacity"
            :class="soundSettings.enabled ? '' : 'pointer-events-none opacity-40'"
          >
            <div class="flex items-center gap-3">
              <span class="w-16 text-sm text-slate-400">Volume</span>
              <input
                v-model.number="soundSettings.volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                :disabled="!soundSettings.enabled"
                class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-pink-500"
              >
              <span class="w-9 text-right text-xs tabular-nums text-slate-500">
                {{ Math.round(soundSettings.volume * 100) }}%
              </span>
            </div>

            <div class="space-y-1">
              <div
                v-for="opt in soundEventOptions"
                :key="opt.key"
                class="flex items-center justify-between gap-2 rounded-md py-1.5"
              >
                <span class="text-sm text-slate-300">{{ opt.label }}</span>
                <div class="flex items-center gap-1">
                  <IconBtn
                    icon="musicCollection"
                    size="sm"
                    variant="ghost"
                    title="Preview"
                    :disabled="!soundSettings.enabled || !soundSettings.events[opt.key]"
                    @click="soundService.play(opt.sound)"
                  />
                  <Switch v-model="soundSettings.events[opt.key]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 class="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Trigger words
        </h3>
        <p class="mb-3 text-xs text-slate-500">
          Play the mention sound whenever any of these words appears in chat.
        </p>

        <div class="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
          <form
            class="flex items-center gap-2"
            @submit.prevent="addWord"
          >
            <Input
              ref="inputEl"
              v-model="newWord"
              placeholder="Add a word…"
              :maxlength="50"
            />
            <Btn
              type="submit"
              :disabled="!newWord.trim()"
            >
              <template #icon>
                <Icon
                  name="plus"
                  size="sm"
                />
              </template>
              Add
            </Btn>
          </form>

          <div
            v-if="mentionKeywords.words.length"
            class="mt-4 flex flex-wrap gap-2"
          >
            <span
              v-for="word in mentionKeywords.words"
              :key="word"
              class="inline-flex items-center gap-1.5 rounded-full bg-slate-700/60 py-1 pl-3 pr-1.5 text-sm text-slate-200"
            >
              {{ word }}
              <button
                type="button"
                class="flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-600 hover:text-rose-300"
                :title="`Remove ${word}`"
                @click="removeMentionKeyword(word)"
              >
                <Icon
                  name="close"
                  size="xs"
                />
              </button>
            </span>
          </div>
          <p
            v-else
            class="mt-4 text-sm text-slate-500"
          >
            No trigger words yet.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import Switch from '@/components/UI/Switch.vue'
import IconBtn from '@/components/UI/IconBtn.vue'
import Input from '@/components/UI/Input.vue'
import Btn from '@/components/UI/Btn.vue'
import Icon from '@/components/UI/Icon.vue'
import { soundSettings, notificationSettings, type SoundEvent } from '@/stores/settings'
import { soundService, type SoundName } from '@/services/sound'
import { mentionKeywords, addMentionKeyword, removeMentionKeyword } from '@/stores/mentionKeywords'

const router = useRouter()

const soundEventOptions: { key: SoundEvent, sound: SoundName, label: string }[] = [
  { key: 'mention', sound: 'mention', label: 'New PM / mention' },
  { key: 'matchStart', sound: 'matchStart', label: 'Match started' },
  { key: 'matchFinish', sound: 'matchFinish', label: 'Match finished' },
  { key: 'allReady', sound: 'allReady', label: 'All players ready' },
  { key: 'timerEnd', sound: 'timerEnd', label: 'Timer ended' },
]

const newWord = ref('')
const inputEl = useTemplateRef('inputEl')

async function addWord() {
  const added = await addMentionKeyword(newWord.value)
  if (added) newWord.value = ''
  inputEl.value?.focus()
}
</script>
