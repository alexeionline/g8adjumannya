<script setup>
import { computed, ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AppActionButton from '@/components/base/AppActionButton.vue'
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
  goal: { type: Number, default: 100 },
  editableUserId: { type: [String, Number], default: '' },
  onRefresh: { type: Function, default: null },
  onUpdateApproach: { type: Function, default: null },
  onDeleteApproach: { type: Function, default: null },
})

const editing = ref(null)
const editInput = ref('')
const deleteDialogOpen = ref(false)
const pendingDelete = ref(null)
const showAll = ref(false)
const TOP_LIMIT = 5

const displayedItems = computed(() => {
  const normalized = (props.items || []).map((item, index) => ({
    ...item,
    rowRank: index + 1,
  }))
  return showAll.value ? normalized : normalized.slice(0, TOP_LIMIT)
})

function isEditing(itemKey, index) {
  return editing.value && editing.value.itemKey === itemKey && editing.value.index === index
}

function startEdit(itemKey, index, approach) {
  if (!canEditApproach(itemKey, approach)) return
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

function canEditApproach(itemKey, approach) {
  const owner = String(itemKey ?? '')
  const currentUser = String(props.editableUserId ?? '')
  const id = approachId(approach)
  return Boolean(currentUser) && owner === currentUser && id != null
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
  <Card class="results-card">
    <CardHeader class="results-header">
      <CardTitle>Результаты сегодня</CardTitle>
      <p class="results-sub">Актуальный статус участников чата</p>
    </CardHeader>
    <CardContent>
      <template v-if="items.length">
        <ul class="today-list">
          <li
            v-for="item in displayedItems"
            :key="item.key"
            :class="['today-row', { 'today-row-done': item.value >= goal }]"
          >
            <div class="row-rank">{{ item.rowRank }}</div>
            <TodayProgress :value="item.value" :goal="goal" />
            <div class="today-body">
              <div class="today-title-row">
                <div class="today-username">{{ item.label }}</div>
              </div>
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
                    <AppActionButton type="button" size="sm" variant="primary" @click="saveEdit">Сохранить</AppActionButton>
                    <AppActionButton type="button" size="sm" variant="outline" @click="closeEdit">Отмена</AppActionButton>
                    <AppActionButton type="button" size="sm" variant="danger" @click="openDeleteDialog">Удалить</AppActionButton>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="approach-pill"
                    :class="{ 'approach-pill-passive': !canEditApproach(item.key, approach) }"
                    :title="canEditApproach(item.key, approach) ? 'Редактировать подход' : String(approachCount(approach))"
                    @click="startEdit(item.key, i, { id: approachId(approach), count: approachCount(approach) })"
                  >
                    {{ approachCount(approach) }}
                  </button>
                </template>
              </div>
            </div>
          </li>
        </ul>
        <div v-if="items.length > TOP_LIMIT" class="show-more-wrap">
          <AppActionButton type="button" size="sm" variant="subtle" class="show-more-btn" @click="showAll = !showAll">
            {{ showAll ? 'Свернуть' : 'Показать всех' }}
          </AppActionButton>
        </div>
      </template>
      <div v-else class="results-empty">
        За сегодня пока нет данных. Добавь первый подход
      </div>

      <AlertDialog v-model:open="deleteDialogOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить подход?</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить {{ editing?.count ?? '' }} повторений из этого подхода? Действие нельзя отменить.
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
.results-card {
  border: 0;
  box-shadow: var(--shadow-soft);
}

.results-header {
  padding-bottom: 0.2rem;
}

.results-sub {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--muted-foreground);
}

.today-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.68rem;
}

.today-row {
  display: grid;
  grid-template-columns: 1.7rem auto 1fr;
  gap: 0.65rem;
  align-items: start;
  padding: 0.72rem;
  border-radius: 1rem;
  background: rgba(240, 246, 252, 0.78);
  border: 1px solid rgba(16, 49, 87, 0.06);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.today-row:hover {
  transform: translateY(-1px);
}

.today-row-done {
  background: linear-gradient(130deg, rgba(196, 248, 225, 0.82), rgba(240, 255, 250, 0.74));
}

.row-rank {
  margin-top: 0.2rem;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 0.67rem;
  font-weight: 700;
  color: var(--foreground-strong);
  background: rgba(19, 56, 91, 0.1);
}

.today-body {
  min-width: 0;
}

.today-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.today-username {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--foreground-strong);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.today-approaches {
  margin-top: 0.45rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.today-approach-elapsed {
  font-size: 0.62rem;
  color: var(--muted-foreground);
}

.approach-pill {
  border: 0;
  border-radius: 999px;
  min-height: 1.4rem;
  padding: 0.14rem 0.54rem;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--foreground);
  background: rgba(10, 152, 255, 0.13);
  transition: background-color 0.2s ease;
}

.approach-pill:hover {
  background: rgba(10, 152, 255, 0.2);
}

.approach-pill-passive {
  cursor: default;
  background: rgba(18, 48, 88, 0.09);
}

.today-approach-edit {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.today-approach-input {
  width: 4.2rem;
}

.results-empty {
  border-radius: 1rem;
  padding: 1rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted-foreground);
  background: rgba(242, 246, 252, 0.9);
}

.show-more-wrap {
  margin-top: 0.75rem;
  display: flex;
  justify-content: center;
}

.show-more-btn {
  min-width: 9rem;
  border-radius: 999px;
  border: 1px solid rgba(10, 88, 156, 0.26);
  background: linear-gradient(145deg, rgba(239, 249, 255, 0.96), rgba(223, 241, 255, 0.94));
  color: color-mix(in oklab, var(--foreground-strong) 85%, #0ea5e9 15%);
  font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 8px 18px rgba(14, 165, 233, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.show-more-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(14, 165, 233, 0.18);
  background: linear-gradient(145deg, rgba(226, 245, 255, 0.98), rgba(203, 233, 255, 0.94));
}
</style>
