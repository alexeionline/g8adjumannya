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
const expandedRows = ref({})
const showApproaches = ref(false)
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

function progressPercent(value) {
  const total = Number(value || 0)
  const target = Math.max(1, Number(props.goal || 100))
  return Math.max(0, Math.min(100, (total / target) * 100))
}

function isRowExpanded(itemKey) {
  return Boolean(expandedRows.value[String(itemKey)])
}

function toggleRowExpanded(itemKey) {
  const key = String(itemKey)
  expandedRows.value = {
    ...expandedRows.value,
    [key]: !expandedRows.value[key],
  }
}

function shouldShowApproaches(itemKey) {
  return showApproaches.value || isRowExpanded(itemKey)
}

function toggleAllApproaches() {
  showApproaches.value = !showApproaches.value
  if (!showApproaches.value) {
    expandedRows.value = {}
  }
}

function onApproachBeforeEnter(el) {
  el.style.height = '0px'
  el.style.opacity = '0'
  el.style.overflow = 'hidden'
}

function onApproachEnter(el) {
  const height = `${el.scrollHeight}px`
  el.style.transition = 'height 170ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 120ms ease'
  void el.offsetHeight
  el.style.height = height
  el.style.opacity = '1'
}

function onApproachAfterEnter(el) {
  el.style.height = 'auto'
  el.style.overflow = ''
  el.style.transition = ''
}

function onApproachBeforeLeave(el) {
  el.style.height = `${el.scrollHeight}px`
  el.style.opacity = '1'
  el.style.overflow = 'hidden'
}

function onApproachLeave(el) {
  el.style.transition = 'height 140ms cubic-bezier(0.4, 0, 0.2, 1), opacity 100ms ease'
  void el.offsetHeight
  el.style.height = '0px'
  el.style.opacity = '0'
}

function onApproachAfterLeave(el) {
  el.style.height = ''
  el.style.opacity = ''
  el.style.overflow = ''
  el.style.transition = ''
}
</script>

<template>
  <Card class="results-card">
    <CardHeader class="results-header">
      <div class="results-head-row">
        <div>
          <CardTitle>Результаты сегодня</CardTitle>
          <p class="results-sub">Актуальный статус участников чата</p>
        </div>
        <div class="approach-toggle">
          <span class="approach-toggle-label">Подходы</span>
          <button
            type="button"
            class="approach-toggle-btn"
            role="switch"
            :aria-checked="showApproaches"
            :title="showApproaches ? 'Подходы включены' : 'Подходы выключены'"
            @click="toggleAllApproaches"
          >
            <span :class="['approach-toggle-track', { 'approach-toggle-track-on': showApproaches }]" aria-hidden="true">
            <span class="approach-toggle-thumb" />
            </span>
          </button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <template v-if="items.length">
        <ul class="today-list">
          <li
            v-for="item in displayedItems"
            :key="item.key"
            class="today-row"
            @click="!showApproaches && toggleRowExpanded(item.key)"
          >
            <div class="today-top">
              <div class="row-rank">{{ item.rowRank }}</div>
              <div class="today-top-main">
                <div class="today-title-row">
                  <div class="today-username">{{ item.label }}</div>
                </div>
              </div>
            </div>
            <div
              class="today-progress-strip"
              role="progressbar"
              :aria-valuemin="0"
              :aria-valuemax="goal"
              :aria-valuenow="item.value"
              :aria-label="`${item.value} из ${goal}`"
            >
              <span class="today-progress-base" />
              <span
                v-if="item.value > 0"
                :class="['today-progress-fill', { 'today-progress-fill-complete': item.value >= goal }]"
                :style="{ width: `${progressPercent(item.value)}%` }"
              >
                <span class="today-progress-value">{{ item.value }}</span>
              </span>
            </div>
            <transition
              @before-enter="onApproachBeforeEnter"
              @enter="onApproachEnter"
              @after-enter="onApproachAfterEnter"
              @before-leave="onApproachBeforeLeave"
              @leave="onApproachLeave"
              @after-leave="onApproachAfterLeave"
            >
              <div v-if="shouldShowApproaches(item.key)" class="today-bottom" @click.stop>
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
                      @click.stop
                      @keydown.enter.prevent="saveEdit"
                      @keydown.escape="closeEdit"
                    />
                    <AppActionButton type="button" size="sm" variant="primary" @click.stop="saveEdit">Сохранить</AppActionButton>
                    <AppActionButton type="button" size="sm" variant="outline" @click.stop="closeEdit">Отмена</AppActionButton>
                    <AppActionButton type="button" size="sm" variant="danger" @click.stop="openDeleteDialog">Удалить</AppActionButton>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="approach-pill"
                    :class="{ 'approach-pill-passive': !canEditApproach(item.key, approach) }"
                    :title="canEditApproach(item.key, approach) ? 'Редактировать подход' : String(approachCount(approach))"
                    @click.stop="startEdit(item.key, i, { id: approachId(approach), count: approachCount(approach) })"
                  >
                    {{ approachCount(approach) }}
                  </button>
                </template>
                <span v-if="!item.approaches || item.approaches.length === 0" class="today-approach-empty">
                  Нет подходов
                </span>
              </div>
            </div>
            </transition>
          </li>
        </ul>
        <div v-if="items.length > TOP_LIMIT" class="show-more-wrap">
          <AppActionButton
            type="button"
            size="md"
            variant="fold"
            class="show-more-btn"
            :title="showAll ? 'Свернуть' : 'Показать всех'"
            :aria-label="showAll ? 'Свернуть' : 'Показать всех'"
            @click="showAll = !showAll"
          >
            <span class="fold-icon">{{ showAll ? '▴' : '▾' }}</span>
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

.results-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.results-sub {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--muted-foreground);
}

.approach-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.46rem;
  user-select: none;
}

.approach-toggle-label {
  font-size: 0.6rem;
  font-weight: 500;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.approach-toggle-btn {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.approach-toggle-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.approach-toggle-track {
  width: 2.15rem;
  height: 1.2rem;
  border-radius: 999px;
  background: rgba(70, 210, 255, 0.42);
  padding: 0.12rem;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.18s ease;
}

.approach-toggle-thumb {
  width: 0.96rem;
  height: 0.96rem;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(13, 34, 55, 0.28);
  transform: translateX(0);
  transition: transform 0.18s ease;
}

.approach-toggle-track-on {
  background: color-mix(in oklab, #46d2ff 86%, #25bab0 14%);
}

.approach-toggle-track-on .approach-toggle-thumb {
  transform: translateX(0.95rem);
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
  grid-template-columns: 1fr;
  gap: 0;
  padding: 0;
  border-radius: 0.7rem;
  background: #f8f8f8;
  border: 1px solid rgba(16, 49, 87, 0.06);
  transition: transform 0.2s ease, background-color 0.2s ease;
  overflow: hidden;
  cursor: pointer;
}

.today-row:hover {
  transform: translateY(-1px);
}

.today-top {
  display: grid;
  grid-template-columns: 1.7rem 1fr;
  align-items: start;
  gap: 0.5rem;
  padding: 0.3rem;
}

.today-top-main {
  min-width: 0;
}

.today-bottom {
  padding: 0.4rem;
  border-top: 1px solid rgba(16, 49, 87, 0.08);
  background: rgba(234, 235, 232, 0.38);
  cursor: default;
  will-change: height, opacity;
}

.row-rank {
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
  margin-top: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.today-approach-empty {
  font-size: 0.66rem;
  color: var(--muted-foreground);
}

.today-approach-elapsed {
  font-size: 0.62rem;
  color: var(--muted-foreground);
}

.approach-pill {
  border: 0;
  border-radius: 8px;
  min-height: 1.4rem;
  padding: 0.14rem 0.54rem;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  color: rgba(20, 20, 20);
  background: rgba(64, 64, 64, 0.08);
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

.today-progress-strip {
  position: relative;
  height: 15px;
}

.today-progress-base {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 10px;
  border-bottom-right-radius: 5px;
  background: #eaebe8;
}

.today-progress-fill {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 15px;
  border-top-right-radius: 5px;
  background: linear-gradient(90deg, var(--accent-strong), #46d2ff);
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 0.38rem 0 0.45rem;
}

.today-progress-fill-complete {
  border-top-right-radius: 0;
}

.today-progress-value {
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  color: #fff;
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
  display: block;
}

.show-more-btn {
  width: 100%;
}

.fold-icon {
  color: #3f4a54;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55), 0 -1px 0 rgba(28, 38, 49, 0.28);
}

</style>
