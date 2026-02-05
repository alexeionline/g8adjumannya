<script setup>
import { ref } from 'vue'
import ProgressBar from './ProgressBar.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  onRefresh: { type: Function, default: null },
  onUpdateApproach: { type: Function, default: null },
  onDeleteApproach: { type: Function, default: null },
})

const GOAL = 100
const editing = ref(null)
const editInput = ref('')

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
}

async function saveEdit() {
  if (!editing.value || !props.onUpdateApproach) return
  const count = Math.max(1, Math.min(1000, Number(editInput.value) || 0))
  await props.onUpdateApproach(editing.value.id, editing.value.itemKey, count)
  if (props.onRefresh) await props.onRefresh()
  closeEdit()
}

async function removeApproach() {
  if (!editing.value || !props.onDeleteApproach) return
  await props.onDeleteApproach(editing.value.id, editing.value.itemKey)
  if (props.onRefresh) await props.onRefresh()
  closeEdit()
}

function approachCount(approach) {
  return typeof approach === 'object' && approach != null && 'count' in approach ? approach.count : Number(approach) || 0
}

function approachId(approach) {
  return typeof approach === 'object' && approach != null && 'id' in approach ? approach.id : null
}

/** Интервал между подходами в формате h:mm */
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
  const v = approach.created_at
  return v != null ? v : null
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
  <section class="card">
    <h2>Сегодня</h2>
    <ul class="today-list">
      <li
        v-for="item in items"
        :key="item.key"
        :class="{ 'result-done': item.value >= GOAL, 'result-pending': item.value < GOAL }"
        class="today-row"
      >
        <div class="today-left">
          <ProgressBar :value="item.value" :goal="GOAL" />
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
                <input
                  v-model="editInput"
                  type="number"
                  min="1"
                  max="1000"
                  class="today-approach-input"
                  @keydown.enter="saveEdit"
                  @keydown.escape="closeEdit"
                />
                <button type="button" class="today-approach-btn today-approach-btn-save" title="Сохранить" @click="saveEdit">💾</button>
                <button type="button" class="today-approach-btn today-approach-btn-close" title="Закрыть" @click="closeEdit">✕</button>
                <button type="button" class="today-approach-btn today-approach-btn-delete" title="Удалить" @click="removeApproach">🗑</button>
              </div>
              <button
                v-else
                type="button"
                class="today-approach-square today-approach-clickable"
                :class="{ 'today-approach-no-edit': approachId(approach) == null }"
                :title="approachId(approach) != null ? 'Нажмите для редактирования' : String(approachCount(approach))"
                @click="startEdit(item.key, i, { id: approachId(approach), count: approachCount(approach) })"
              >
                {{ approachCount(approach) }}
              </button>
            </template>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: 16px;
}

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
  grid-template-columns: 64px 1fr;
  gap: 12px;
  align-items: stretch;
  min-height: 80px;
  padding: 10px;
  border: 1px solid #edf0f5;
  border-radius: 8px;
}

.today-left {
  display: flex;
  align-items: stretch;
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
  padding: 5px;
  border-bottom: 1px solid #edf0f5;
  font-weight: 600;
  font-size: 15px;
  color: #1f2a44;
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
  font-size: 11px;
  font-weight: 400;
  color: #6b7280;
  padding: 0 2px;
  min-width: 28px;
  text-align: center;
}

.today-approach-square {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 12px;
  padding: 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: #1f2a44;
  background: transparent;
  border: none;
}

/* У всех кроме последнего — правый бордер; у последнего (и единственного) — без бордеров */
.today-approach-square:not(:last-child) {
  border-right: 1px solid #edf0f5;
}

/* У всех кроме первого — левый бордер */
.today-approach-square:not(:first-child) {
  border-left: 1px solid #edf0f5;
}

.today-approach-clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}
.today-approach-clickable:hover {
  opacity: 0.9;
}
.today-approach-no-edit {
  cursor: default;
}

.result-done .today-approach-square,
.result-pending .today-approach-square {
  background: transparent;
  color: #1f2a44;
}

.today-approach-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.today-approach-input {
  width: 48px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.today-approach-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.today-approach-btn:hover {
  background: #f3f4f6;
}
.today-approach-btn-save {
  background: #dcfce7;
  border-color: #86efac;
}
.today-approach-btn-save:hover {
  background: #bbf7d0;
}
.today-approach-btn-delete:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}
</style>
