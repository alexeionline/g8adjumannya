<script setup>
import { ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import TodayProgress from './TodayProgress.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  onRefresh: { type: Function, default: null },
  onUpdateApproach: { type: Function, default: null },
  onDeleteApproach: { type: Function, default: null },
})

const GOAL = 100
const editing = ref(null)
const editInput = ref('')
const deleteDialogOpen = ref(false)
const pendingDelete = ref(null)

function isEditing(itemKey, index) {
  return editing.value && editing.value.itemKey === itemKey && editing.value.index === index
}

function startEdit(itemKey, index, approach) {
  if (approach.id == null) return
  editing.value = { itemKey, index, id: approach.id, count: approach.count }
  editInput.value = String(approach.count)
}

function closeEdit() {
  editing.value = null
  editInput.value = ''
  pendingDelete.value = null
}

async function saveEdit() {
  if (!editing.value || !props.onUpdateApproach) return
  const count = Math.max(1, Math.min(1000, Number(editInput.value) || 0))
  await props.onUpdateApproach(editing.value.id, editing.value.itemKey, count)
  if (props.onRefresh) await props.onRefresh()
  closeEdit()
}

function openDeleteDialog() {
  if (!editing.value) return
  pendingDelete.value = { id: editing.value.id, itemKey: editing.value.itemKey }
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value || !props.onDeleteApproach) return
  await props.onDeleteApproach(pendingDelete.value.id, pendingDelete.value.itemKey)
  if (props.onRefresh) await props.onRefresh()
  deleteDialogOpen.value = false
  closeEdit()
}

function approachCount(approach) {
  return typeof approach === 'object' && approach != null && 'count' in approach ? approach.count : Number(approach) || 0
}

function approachId(approach) {
  return typeof approach === 'object' && approach != null && 'id' in approach ? approach.id : null
}

function formatElapsed(createdAtPrev, createdAtCur) {
  if (!createdAtPrev || !createdAtCur) return null
  const prev = new Date(createdAtPrev).getTime()
  const cur = new Date(createdAtCur).getTime()
  if (Number.isNaN(prev) || Number.isNaN(cur) || cur < prev) return null
  const totalMinutes = Math.floor((cur - prev) / 60_000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function approachCreatedAt(approach) {
  if (typeof approach !== 'object' || approach == null) return null
  return approach.created_at ?? null
}

function elapsedText(prev, cur) {
  const text = formatElapsed(approachCreatedAt(prev), approachCreatedAt(cur))
  return text != null ? text : '–'
}

function elapsedTitle(prev, cur) {
  const text = formatElapsed(approachCreatedAt(prev), approachCreatedAt(cur))
  return text != null ? `${text} между подходами` : 'нет данных'
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Сегодня</CardTitle>
    </CardHeader>
    <CardContent>
      <ul class="today-list">
        <li
          v-for="item in items"
          :key="item.key"
          :class="{ 'result-done': item.value >= GOAL, 'result-pending': item.value < GOAL }"
          class="today-row"
        >
          <div class="today-left">
            <TodayProgress :value="item.value" :goal="GOAL" />
          </div>
          <div class="today-right">
            <div class="today-username">{{ item.label }}</div>
            <div class="today-approaches">
              <template v-for="(approach, i) in item.approaches" :key="approach.id || i">
                <span
                  v-if="i > 0"
                  class="today-approach-elapsed"
                  :title="elapsedTitle(item.approaches[i - 1], approach)"
                >{{ elapsedText(item.approaches[i - 1], approach) }}</span>
                <div v-if="isEditing(item.key, i)" class="today-approach-edit">
                  <Input
                    v-model="editInput"
                    type="number"
                    min="1"
                    max="1000"
                    class="today-approach-input"
                    @keydown.enter.prevent="saveEdit"
                    @keydown.escape="closeEdit"
                  />
                  <Button type="button" size="sm" variant="default" title="Сохранить" @click="saveEdit">
                    Сохранить
                  </Button>
                  <Button type="button" size="sm" variant="outline" title="Закрыть" @click="closeEdit">
                    Отмена
                  </Button>
                  <Button type="button" size="sm" variant="destructive" title="Удалить" @click="openDeleteDialog">
                    Удалить
                  </Button>
                </div>
                <Button
                  v-else
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="today-approach-square"
                  :class="{ 'today-approach-no-edit': approachId(approach) == null }"
                  :title="approachId(approach) != null ? 'Нажмите для редактирования' : String(approachCount(approach))"
                  @click="startEdit(item.key, i, { id: approachId(approach), count: approachCount(approach) })"
                >
                  {{ approachCount(approach) }}
                </Button>
              </template>
            </div>
          </div>
        </li>
      </ul>

      <AlertDialog v-model:open="deleteDialogOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить подход?</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить подход {{ editing?.count ?? '' }} отжиманий? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="confirmDelete">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent>
  </Card>
</template>

<style scoped>
.today-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.today-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 12px;
  align-items: stretch;
  min-height: 72px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.today-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.today-right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  width: 100%;
}

.today-username {
  text-align: left;
  padding: 2px 0;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.today-approaches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
}

.today-approach-elapsed {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--muted-foreground);
  padding: 0 2px;
  min-width: 28px;
  text-align: center;
}

.today-approach-square {
  min-width: 24px;
  height: auto;
  padding: 2px 6px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.today-approach-clickable {
  cursor: pointer;
}

.today-approach-no-edit {
  cursor: default;
}

.today-approach-edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.today-approach-input {
  width: 64px;
}
</style>
