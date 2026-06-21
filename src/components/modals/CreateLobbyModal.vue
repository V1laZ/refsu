<template>
  <Modal
    v-model="open"
    title="Create multiplayer lobby"
    size="md"
  >
    <form
      id="createLobbyForm"
      class="space-y-4"
      @submit.prevent="handleCreateLobby"
    >
      <Field
        label="Lobby name"
        required
      >
        <Input
          ref="lobbyNameInputRef"
          v-model="lobbyName"
          placeholder="Enter lobby name"
          :maxlength="50"
          autofocus
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

      <Field label="Score mode">
        <Select v-model="scoreMode">
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

      <Field label="Mappool">
        <Select v-model="mappoolId">
          <option :value="null">
            None
          </option>
          <option
            v-for="mappool in mappools"
            :key="mappool.id"
            :value="mappool.id"
          >
            {{ mappool.name }}
          </option>
        </Select>
      </Field>
    </form>

    <template #footer>
      <Btn
        variant="ghost"
        @click="open = false"
      >
        Cancel
      </Btn>
      <Btn
        form="createLobbyForm"
        type="submit"
        :disabled="!lobbyName.trim() || loading"
        :loading="loading"
      >
        Create lobby
      </Btn>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { CreateLobbySettings } from '@/types'
import { useMappools } from '@/composables/useMappools'
import Modal from '@/components/UI/Modal.vue'
import Btn from '@/components/UI/Btn.vue'
import Input from '@/components/UI/Input.vue'
import Select from '@/components/UI/Select.vue'
import Field from '@/components/UI/Field.vue'

const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  createLobby: [settings: CreateLobbySettings]
}>()

const { mappools, loadMappools } = useMappools()

const loading = ref(false)
const lobbyName = ref('')
const teamMode = ref<CreateLobbySettings['teamMode']>('2')
const scoreMode = ref<CreateLobbySettings['scoreMode']>('3')
const mappoolId = ref<CreateLobbySettings['mappoolId']>(null)
const lobbyNameInputRef = useTemplateRef<{ focus: () => void }>('lobbyNameInputRef')

const handleCreateLobby = () => {
  const name = lobbyName.value.trim()

  if (!name) {
    alert('Please enter a lobby name')
    return
  }

  if (name.length > 50) {
    alert('Lobby name is too long (max 50 characters)')
    return
  }

  loading.value = true

  emit('createLobby', {
    name: lobbyName.value,
    teamMode: teamMode.value,
    scoreMode: scoreMode.value,
    mappoolId: mappoolId.value,
  })
}

watch(open, (newValue) => {
  if (newValue) {
    loadMappools()
    nextTick(() => lobbyNameInputRef.value?.focus())
  }
}, { immediate: true, flush: 'post' })
</script>
