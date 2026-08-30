#!/usr/bin/env bun
/**
 * send-pr.ts — Constructs a PR with bug fixes for App.vue and sends it to the Reporter server.
 */

const SERVER = "http://localhost:2400";

// --- Build diff for App.vue ---

// Original lines (1-indexed in the file)
const original = [
  '<script setup>',
  "import { ref, computed, watch } from 'vue'",
  '',
  'const todos = ref([])',
  "const newTodoText = ref('')",
  "const filter = ref('all')",
  '',
  "// BUG: loads from 'todos' key but save uses 'todo-list' key (mismatch)",
  "const saved = localStorage.getItem('todos')",
  'if (saved) {',
  '  todos.value = JSON.parse(saved)',
  '}',
  '',
  'const filteredTodos = computed(() => {',
  "  if (filter.value === 'active') {",
  '    // BUG: reversed filter — "active" shows completed items',
  '    return todos.value.filter(t => t.completed)',
  '  }',
  "  if (filter.value === 'completed') {",
  '    // BUG: reversed filter — "completed" shows active items',
  '    return todos.value.filter(t => !t.completed)',
  '  }',
  '  return todos.value',
  '})',
  '',
  'const remainingCount = computed(() => {',
  '  // BUG: counts completed items instead of incomplete items',
  '  return todos.value.filter(t => t.completed).length',
  '})',
  '',
  'function addTodo() {',
  '  const text = newTodoText.value.trim()',
  '  if (!text) return',
  '',
  '  todos.value.push({',
  '    id: Date.now(),',
  '    text: text,',
  '    completed: false',
  '  })',
  '',
  '  // BUG: input field is never cleared after adding a todo',
  '}',
  '',
  'function toggleTodo(index) {',
  '  // BUG: index comes from the filtered list, not the full todos array.',
  '  // When a filter is active, this toggles the wrong todo.',
  '  todos.value[index].completed = !todos.value[index].completed',
  '}',
  '',
  'function deleteTodo(index) {',
  '  // BUG: index comes from the filtered list. splice on the full array',
  '  // removes the wrong item when a filter is active.',
  '  todos.value.splice(index, 1)',
  '}',
  '',
  'function clearCompleted() {',
  '  todos.value = todos.value.filter(t => !t.completed)',
  '}',
  '',
  "// BUG: saves to 'todo-list' key but load reads from 'todos' key.",
  '// Changes never persist across reloads.',
  'watch(todos, (val) => {',
  "  localStorage.setItem('todo-list', JSON.stringify(val))",
  '}, { deep: true })',
  '</script>',
  '',
  '<template>',
  '  <div class="app-header">',
  '    <h1>Todo</h1>',
  '    <p>A basic todo application</p>',
  '  </div>',
  '',
  '  <div class="todo-card">',
  '    <div class="todo-input-row">',
  '      <input',
  '        v-model="newTodoText"',
  '        class="todo-input"',
  '        placeholder="What needs to be done?"',
  '        @keyup.enter="addTodo"',
  '      />',
  '      <button class="todo-add-btn" @click="addTodo">Add</button>',
  '    </div>',
  '',
  '    <div class="todo-filters">',
  '      <button',
  '        class="todo-filter-btn"',
  '        :class="{ active: filter === \'all\' }"',
  "        @click=\"filter = 'all'\"",
  '      >All</button>',
  '      <button',
  '        class="todo-filter-btn"',
  '        :class="{ active: filter === \'active\' }"',
  "        @click=\"filter = 'active'\"",
  '      >Active</button>',
  '      <button',
  '        class="todo-filter-btn"',
  '        :class="{ active: filter === \'completed\' }"',
  "        @click=\"filter = 'completed'\"",
  '      >Completed</button>',
  '    </div>',
  '',
  '    <ul class="todo-list" v-if="filteredTodos.length">',
  '      <li',
  '        v-for="(todo, index) in filteredTodos"',
  '        :key="todo.id"',
  '        class="todo-item"',
  '      >',
  '        <input',
  '          type="checkbox"',
  '          class="todo-checkbox"',
  '          :checked="todo.completed"',
  '          @change="toggleTodo(index)"',
  '        />',
  '        <span class="todo-text" :class="{ completed: todo.completed }">',
  '          {{ todo.text }}',
  '        </span>',
  '        <button class="todo-delete-btn" @click="deleteTodo(index)">×</button>',
  '      </li>',
  '    </ul>',
  '',
  '    <div class="todo-empty" v-else>',
  '      No todos yet. Add one above.',
  '    </div>',
  '',
  '    <div class="todo-footer" v-if="todos.length">',
  '      <span>{{ remainingCount }} item{{ remainingCount === 1 ? \'\' : \'s\' }} left</span>',
  '      <button class="todo-clear-btn" @click="clearCompleted">',
  '        Clear completed',
  '      </button>',
  '    </div>',
  '  </div>',
  '</template>',
];

// Fixed lines
const fixed = [
  '<script setup>',
  "import { ref, computed, watch } from 'vue'",
  '',
  'const todos = ref([])',
  "const newTodoText = ref('')",
  "const filter = ref('all')",
  '',
  "const saved = localStorage.getItem('todo-list')",
  'if (saved) {',
  '  todos.value = JSON.parse(saved)',
  '}',
  '',
  'const filteredTodos = computed(() => {',
  "  if (filter.value === 'active') {",
  '    return todos.value.filter(t => !t.completed)',
  '  }',
  "  if (filter.value === 'completed') {",
  '    return todos.value.filter(t => t.completed)',
  '  }',
  '  return todos.value',
  '})',
  '',
  'const remainingCount = computed(() => {',
  '  return todos.value.filter(t => !t.completed).length',
  '})',
  '',
  'function addTodo() {',
  '  const text = newTodoText.value.trim()',
  '  if (!text) return',
  '',
  '  todos.value.push({',
  '    id: Date.now(),',
  '    text: text,',
  '    completed: false',
  '  })',
  '',
  "  newTodoText.value = ''",
  '}',
  '',
  'function toggleTodo(id) {',
  '  const todo = todos.value.find(t => t.id === id)',
  '  if (todo) todo.completed = !todo.completed',
  '}',
  '',
  'function deleteTodo(id) {',
  '  todos.value = todos.value.filter(t => t.id !== id)',
  '}',
  '',
  'function clearCompleted() {',
  '  todos.value = todos.value.filter(t => !t.completed)',
  '}',
  '',
  'watch(todos, (val) => {',
  "  localStorage.setItem('todo-list', JSON.stringify(val))",
  '}, { deep: true })',
  '</script>',
  '',
  '<template>',
  '  <div class="app-header">',
  '    <h1>Todo</h1>',
  '    <p>A basic todo application</p>',
  '  </div>',
  '',
  '  <div class="todo-card">',
  '    <div class="todo-input-row">',
  '      <input',
  '        v-model="newTodoText"',
  '        class="todo-input"',
  '        placeholder="What needs to be done?"',
  '        @keyup.enter="addTodo"',
  '      />',
  '      <button class="todo-add-btn" @click="addTodo">Add</button>',
  '    </div>',
  '',
  '    <div class="todo-filters">',
  '      <button',
  '        class="todo-filter-btn"',
  '        :class="{ active: filter === \'all\' }"',
  "        @click=\"filter = 'all'\"",
  '      >All</button>',
  '      <button',
  '        class="todo-filter-btn"',
  '        :class="{ active: filter === \'active\' }"',
  "        @click=\"filter = 'active'\"",
  '      >Active</button>',
  '      <button',
  '        class="todo-filter-btn"',
  '        :class="{ active: filter === \'completed\' }"',
  "        @click=\"filter = 'completed'\"",
  '      >Completed</button>',
  '    </div>',
  '',
  '    <ul class="todo-list" v-if="filteredTodos.length">',
  '      <li',
  '        v-for="(todo, index) in filteredTodos"',
  '        :key="todo.id"',
  '        class="todo-item"',
  '      >',
  '        <input',
  '          type="checkbox"',
  '          class="todo-checkbox"',
  '          :checked="todo.completed"',
  '          @change="toggleTodo(todo.id)"',
  '        />',
  '        <span class="todo-text" :class="{ completed: todo.completed }">',
  '          {{ todo.text }}',
  '        </span>',
  '        <button class="todo-delete-btn" @click="deleteTodo(todo.id)">×</button>',
  '      </li>',
  '    </ul>',
  '',
  '    <div class="todo-empty" v-else>',
  '      No todos yet. Add one above.',
  '    </div>',
  '',
  '    <div class="todo-footer" v-if="todos.length">',
  '      <span>{{ remainingCount }} item{{ remainingCount === 1 ? \'\' : \'s\' }} left</span>',
  '      <button class="todo-clear-btn" @click="clearCompleted">',
  '        Clear completed',
  '      </button>',
  '    </div>',
  '  </div>',
  '</template>',
];

// --- Generate diff using LCS ---

interface DiffLine {
  type: "context" | "added" | "removed";
  oldNumber: number | null;
  newNumber: number | null;
  content: string;
}

function generateDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNum = 1;
  let newNum = 1;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "context", oldNumber: oldNum, newNumber: newNum, content: oldLines[i] });
      i++;
      j++;
      oldNum++;
      newNum++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", oldNumber: oldNum, newNumber: null, content: oldLines[i] });
      i++;
      oldNum++;
    } else {
      result.push({ type: "added", oldNumber: null, newNumber: newNum, content: newLines[j] });
      j++;
      newNum++;
    }
  }

  while (i < m) {
    result.push({ type: "removed", oldNumber: oldNum, newNumber: null, content: oldLines[i] });
    i++;
    oldNum++;
  }

  while (j < n) {
    result.push({ type: "added", oldNumber: null, newNumber: newNum, content: newLines[j] });
    j++;
    newNum++;
  }

  return result;
}

const diff = generateDiff(original, fixed);
const additions = diff.filter((d) => d.type === "added").length;
const deletions = diff.filter((d) => d.type === "removed").length;

const pr = {
  title: "Fix 7 bugs in basic-todo-application",
  description:
    "Fixes all identified bugs in src/App.vue:\n" +
    "1. localStorage key mismatch — load used 'todos', save used 'todo-list'\n" +
    "2. Active filter showed completed items instead of incomplete\n" +
    "3. Completed filter showed active items instead of completed\n" +
    "4. remainingCount counted completed items instead of incomplete\n" +
    "5. Input field not cleared after adding a todo\n" +
    "6. toggleTodo used filtered list index on full array — wrong item toggled\n" +
    "7. deleteTodo used filtered list index on full array — wrong item deleted",
  branch: "fix/todo-app-bugs",
  files: [
    {
      path: "src/App.vue",
      status: "modified" as const,
      additions,
      deletions,
      diff,
      explanation:
        "Seven bugs fixed: (1) localStorage load key changed from 'todos' to 'todo-list' to match the save key. " +
        "(2) Active filter now filters !t.completed instead of t.completed. " +
        "(3) Completed filter now filters t.completed instead of !t.completed. " +
        "(4) remainingCount now counts !t.completed instead of t.completed. " +
        "(5) Added newTodoText.value = '' after push to clear the input. " +
        "(6) toggleTodo changed to accept id instead of index, uses find() to locate the todo. " +
        "(7) deleteTodo changed to accept id instead of index, uses filter() to remove. " +
        "Template updated to pass todo.id instead of index to both functions.",
    },
  ],
};

// --- Send to server ---

async function main() {
  // Clear existing PRs
  const delRes = await fetch(`${SERVER}/api/prs`, { method: "DELETE" });
  console.log("Clear old PRs:", delRes.status, await delRes.text());

  // POST new PR
  const postRes = await fetch(`${SERVER}/api/pr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pr),
  });
  const postBody = await postRes.text();
  console.log("POST PR:", postRes.status, postBody);

  // Verify
  const healthRes = await fetch(`${SERVER}/api/health`);
  console.log("Health:", await healthRes.text());
}

main().catch((e) => console.error(e));
