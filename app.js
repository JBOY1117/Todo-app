// TaskFlow Studio - Main Application Logic
(function () {
  'use strict';

  const state = {
    todos: [],
    currentView: 'all',
    viewType: 'list',
    searchQuery: '',
    filterPriority: 'all',
    sortBy: 'created_desc',
    activeTimerTask: null,
    timer: {
      timeLeft: 25 * 60,
      totalTime: 25 * 60,
      isRunning: false,
      intervalId: null,
      mode: 'pomodoro',
    },
    editingSubtasks: [],
    useApi: true,
  };

  const STORAGE_KEY = 'taskflow_todos_local';

  const el = {
    workspace: document.getElementById('tasks-workspace'),
    formCreate: document.getElementById('form-create-task'),
    inputTitle: document.getElementById('input-task-title'),
    selectCategory: document.getElementById('select-category'),
    selectPriority: document.getElementById('select-priority'),
    inputDueDate: document.getElementById('input-due-date'),
    checkPinned: document.getElementById('check-pinned'),
    inputSearch: document.getElementById('input-search'),
    selectFilterPriority: document.getElementById('select-filter-priority'),
    selectSort: document.getElementById('select-sort'),
    btnViewList: document.getElementById('btn-view-list'),
    btnViewKanban: document.getElementById('btn-view-kanban'),
    btnClearCompleted: document.getElementById('btn-clear-completed'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    btnPhpApiModal: document.getElementById('btn-php-api-modal'),
    modalPhpApi: document.getElementById('modal-php-api'),
    btnCloseApiModal: document.getElementById('btn-close-api-modal'),
    apiEngineBadge: document.getElementById('api-engine-badge'),
    apiInfoEngine: document.getElementById('api-info-engine'),
    apiInfoPhp: document.getElementById('api-info-php'),
    btnExportJson: document.getElementById('btn-export-json'),
    statPercent: document.getElementById('stat-percent'),
    statProgressBar: document.getElementById('stat-progress-bar'),
    statCompleted: document.getElementById('stat-completed'),
    statTotal: document.getElementById('stat-total'),
    timerDisplay: document.getElementById('timer-display'),
    timerTaskTitle: document.getElementById('timer-task-title'),
    btnTimerStart: document.getElementById('btn-timer-start'),
    btnTimerReset: document.getElementById('btn-timer-reset'),
    timerModeBadge: document.getElementById('timer-mode'),
    modalEdit: document.getElementById('modal-edit-task'),
    btnCloseEdit: document.getElementById('btn-close-edit-modal'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),
    formEdit: document.getElementById('form-edit-task'),
    editId: document.getElementById('edit-task-id'),
    editTitle: document.getElementById('edit-task-title'),
    editNotes: document.getElementById('edit-task-notes'),
    editCategory: document.getElementById('edit-task-category'),
    editPriority: document.getElementById('edit-task-priority'),
    editStatus: document.getElementById('edit-task-status'),
    editDue: document.getElementById('edit-task-due'),
    editSubtasksList: document.getElementById('edit-subtasks-list'),
    inputNewSubtask: document.getElementById('input-new-subtask'),
    btnAddSubtask: document.getElementById('btn-add-subtask'),
    toastContainer: document.getElementById('toast-container'),
  };

  function showToast(msg, type = 'info') {
    if (!el.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 transition-all duration-300 ${
      type === 'success' ? 'bg-teal-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
    }`;
    toast.innerHTML = `<span>${msg}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async function callPhpApi(action, payload = null, method = 'POST') {
    if (!state.useApi) return null;
    try {
      let url = `api.php?action=${action}`;
      let options = { method, headers: { 'Content-Type': 'application/json' } };
      if (method === 'GET') {
        options = { method: 'GET' };
      } else if (payload) {
        options.body = JSON.stringify(payload);
      }
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      state.useApi = false;
      if (el.apiEngineBadge) el.apiEngineBadge.textContent = 'Local Engine';
      return null;
    }
  }

  function loadLocalTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalTodos(todos) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {}
  }

  async function loadTodos() {
    const apiRes = await callPhpApi('list', null, 'GET');
    if (apiRes && apiRes.ok) {
      state.todos = apiRes.todos || [];
      if (el.apiEngineBadge) el.apiEngineBadge.textContent = (apiRes.engine || 'PHP').toUpperCase();
      if (el.apiInfoEngine) el.apiInfoEngine.textContent = apiRes.engine || 'SQLite';
      if (el.apiInfoPhp) el.apiInfoPhp.textContent = apiRes.php_version || 'PHP 8+';
    } else {
      state.todos = loadLocalTodos();
    }
    render();
  }

  async function createTodo(taskData) {
    const apiRes = await callPhpApi('create', taskData, 'POST');
    if (apiRes && apiRes.ok) {
      state.todos.unshift(apiRes.todo);
    } else {
      const newTodo = {
        id: 'tsk_' + Math.random().toString(36).substring(2, 9),
        title: taskData.title,
        notes: taskData.notes || '',
        category: taskData.category || 'Work',
        priority: taskData.priority || 'medium',
        status: taskData.status || 'todo',
        completed: taskData.completed || false,
        pinned: taskData.pinned || false,
        due_date: taskData.due_date || '',
        subtasks: taskData.subtasks || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.todos.unshift(newTodo);
      saveLocalTodos(state.todos);
    }
    showToast('Task added successfully', 'success');
    render();
  }

  async function updateTodo(id, payload) {
    const apiRes = await callPhpApi('update', { id, ...payload }, 'POST');
    if (apiRes && apiRes.ok) {
      const idx = state.todos.findIndex(t => t.id === id);
      if (idx !== -1) state.todos[idx] = apiRes.todo;
    } else {
      const idx = state.todos.findIndex(t => t.id === id);
      if (idx !== -1) {
        state.todos[idx] = { ...state.todos[idx], ...payload, updated_at: new Date().toISOString() };
        if (payload.status === 'done') state.todos[idx].completed = true;
        else if (payload.status && payload.status !== 'done') state.todos[idx].completed = false;
        saveLocalTodos(state.todos);
      }
    }
    render();
  }

  async function deleteTodo(id) {
    const apiRes = await callPhpApi('delete', { id }, 'POST');
    state.todos = state.todos.filter(t => t.id !== id);
    if (!apiRes || !apiRes.ok) saveLocalTodos(state.todos);
    showToast('Task deleted', 'info');
    render();
  }

  async function clearCompleted() {
    const apiRes = await callPhpApi('clear_completed', {}, 'POST');
    state.todos = state.todos.filter(t => !t.completed);
    if (!apiRes || !apiRes.ok) saveLocalTodos(state.todos);
    showToast('Completed tasks cleared', 'info');
    render();
  }

  function getFilteredTodos() {
    const todayStr = new Date().toISOString().split('T')[0];

    return state.todos.filter(todo => {
      if (state.currentView === 'today') {
        if (todo.due_date !== todayStr) return false;
      } else if (state.currentView === 'upcoming') {
        if (!todo.due_date || todo.due_date <= todayStr) return false;
      } else if (state.currentView === 'pinned') {
        if (!todo.pinned) return false;
      } else if (state.currentView === 'completed') {
        if (!todo.completed) return false;
      } else if (['Engineering', 'Design', 'Work', 'Personal', 'Errands'].includes(state.currentView)) {
        if (todo.category !== state.currentView) return false;
      }

      if (state.filterPriority !== 'all' && todo.priority !== state.filterPriority) {
        return false;
      }

      if (state.searchQuery.trim() !== '') {
        const q = state.searchQuery.toLowerCase();
        const matchTitle = todo.title.toLowerCase().includes(q);
        const matchNotes = (todo.notes || '').toLowerCase().includes(q);
        const matchSub = (todo.subtasks || []).some(s => s.text.toLowerCase().includes(q));
        if (!matchTitle && !matchNotes && !matchSub) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      if (state.sortBy === 'created_desc') {
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (state.sortBy === 'created_asc') {
        return new Date(a.created_at) - new Date(b.created_at);
      } else if (state.sortBy === 'due_asc') {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      } else if (state.sortBy === 'priority_desc') {
        const pOrder = { high: 3, medium: 2, low: 1 };
        return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
      }
      return 0;
    });
  }

  function render() {
    if (!el.workspace) return;
    updateStats();
    updateViewBadges();

    const filtered = getFilteredTodos();
    el.workspace.innerHTML = '';

    if (state.viewType === 'list') {
      renderListView(filtered);
    } else {
      renderKanbanView(filtered);
    }
  }

  function updateStats() {
    const total = state.todos.length;
    const completed = state.todos.filter(t => t.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (el.statTotal) el.statTotal.textContent = total;
    if (el.statCompleted) el.statCompleted.textContent = completed;
    if (el.statPercent) el.statPercent.textContent = `${percent}%`;
    if (el.statProgressBar) el.statProgressBar.style.width = `${percent}%`;
  }

  function updateViewBadges() {
    const todayStr = new Date().toISOString().split('T')[0];
    const counts = {
      all: state.todos.length,
      today: state.todos.filter(t => t.due_date === todayStr).length,
      upcoming: state.todos.filter(t => t.due_date && t.due_date > todayStr).length,
      pinned: state.todos.filter(t => t.pinned).length,
      completed: state.todos.filter(t => t.completed).length,
    };

    document.querySelectorAll('[data-view]').forEach(btn => {
      const v = btn.getAttribute('data-view');
      const badge = btn.querySelector('.count-badge');
      if (badge && counts[v] !== undefined) {
        badge.textContent = counts[v];
      }
    });
  }

  function renderListView(todos) {
    if (todos.length === 0) {
      el.workspace.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center text-[var(--text-secondary)]">
          <p class="font-semibold text-sm">No tasks found</p>
          <p class="text-xs mt-1 text-slate-500">Create a task or clear your search filters.</p>
        </div>
      `;
      return;
    }

    const container = document.createElement('div');
    container.className = 'space-y-3';

    todos.forEach(todo => {
      const card = document.createElement('div');
      card.className = `task-card priority-${todo.priority} p-4 flex flex-col gap-3 transition-all hover:border-[var(--border-strong)] ${todo.completed ? 'opacity-60' : ''}`;

      const doneSubtasks = (todo.subtasks || []).filter(s => s.completed).length;
      const totalSubtasks = (todo.subtasks || []).length;

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <button class="btn-toggle-complete mt-0.5 w-5 h-5 rounded-full border border-[var(--border-strong)] flex items-center justify-center shrink-0 ${todo.completed ? 'bg-teal-500 border-teal-500 text-white' : 'hover:border-teal-400'}" data-id="${todo.id}">
              ${todo.completed ? '✓' : ''}
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-semibold text-sm leading-snug ${todo.completed ? 'line-through text-[var(--text-secondary)]' : ''}">${escapeHtml(todo.title)}</h4>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${todo.priority === 'high' ? 'badge-high' : todo.priority === 'medium' ? 'badge-medium' : 'badge-low'}">${todo.priority.toUpperCase()}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)]">${escapeHtml(todo.category)}</span>
              </div>
              ${todo.notes ? `<p class="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">${escapeHtml(todo.notes)}</p>` : ''}
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button class="btn-attach-timer p-1.5 rounded hover:bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] hover:text-teal-400" data-id="${todo.id}" title="Focus on Task">
              ⏱️
            </button>
            <button class="btn-toggle-pin p-1.5 rounded hover:bg-[var(--bg-hover)] text-xs ${todo.pinned ? 'text-amber-400' : 'text-[var(--text-secondary)]'}" data-id="${todo.id}">
              📌
            </button>
            <button class="btn-edit-task p-1.5 rounded hover:bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)]" data-id="${todo.id}">
              ✏️
            </button>
            <button class="btn-delete-task p-1.5 rounded hover:bg-[var(--bg-hover)] text-xs text-rose-400" data-id="${todo.id}">
              🗑️
            </button>
          </div>
        </div>

        ${totalSubtasks > 0 ? `
          <div class="bg-[var(--bg-elevated)] p-2.5 rounded-lg space-y-1.5 text-xs">
            <div class="flex justify-between items-center text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Subtasks (${doneSubtasks}/${totalSubtasks})</span>
              <span>${Math.round((doneSubtasks/totalSubtasks)*100)}%</span>
            </div>
            <div class="space-y-1">
              ${todo.subtasks.map((st, i) => `
                <div class="flex items-center gap-2">
                  <input type="checkbox" class="btn-toggle-subtask rounded bg-[var(--bg-surface)] text-teal-500 text-xs" data-id="${todo.id}" data-index="${i}" ${st.completed ? 'checked' : ''}>
                  <span class="${st.completed ? 'line-through text-[var(--text-secondary)]' : ''}">${escapeHtml(st.text)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]">
          <div class="flex items-center gap-3">
            ${todo.due_date ? `<span>📅 ${todo.due_date}</span>` : ''}
            <span>Status: ${todo.status.replace('_', ' ')}</span>
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    el.workspace.appendChild(container);
  }

  function renderKanbanView(todos) {
    const columns = [
      { id: 'todo', title: 'To Do', color: 'text-slate-400' },
      { id: 'in_progress', title: 'In Progress', color: 'text-amber-400' },
      { id: 'done', title: 'Completed', color: 'text-teal-400' },
    ];

    const kanbanGrid = document.createElement('div');
    kanbanGrid.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 h-full';

    columns.forEach(col => {
      const colTodos = todos.filter(t => col.id === 'done' ? t.completed : t.status === col.id);

      const colEl = document.createElement('div');
      colEl.className = 'tf-surface p-4 flex flex-col gap-3 min-h-[400px]';
      colEl.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <h3 class="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
            ${col.title}
          </h3>
          <span class="text-xs font-mono bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">${colTodos.length}</span>
        </div>
        <div class="kanban-cards-container flex-1 space-y-3 overflow-y-auto"></div>
      `;

      const cardsContainer = colEl.querySelector('.kanban-cards-container');

      if (colTodos.length === 0) {
        cardsContainer.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-secondary)] italic">No tasks</div>`;
      } else {
        colTodos.forEach(todo => {
          const card = document.createElement('div');
          card.className = `task-card priority-${todo.priority} p-3 flex flex-col gap-2`;
          card.innerHTML = `
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-semibold text-xs leading-snug ${todo.completed ? 'line-through text-[var(--text-secondary)]' : ''}">${escapeHtml(todo.title)}</h4>
              <button class="btn-edit-task text-xs text-[var(--text-secondary)] hover:text-white" data-id="${todo.id}">✏️</button>
            </div>
            <div class="flex items-center justify-between text-[10px] text-[var(--text-secondary)] mt-1">
              <span class="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)]">${escapeHtml(todo.category)}</span>
              <div class="flex gap-1">
                ${col.id !== 'todo' ? `<button class="btn-move-stage px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] hover:bg-teal-500/20" data-id="${todo.id}" data-target="prev">←</button>` : ''}
                ${col.id !== 'done' ? `<button class="btn-move-stage px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] hover:bg-teal-500/20" data-id="${todo.id}" data-target="next">→</button>` : ''}
              </div>
            </div>
          `;
          cardsContainer.appendChild(card);
        });
      }

      kanbanGrid.appendChild(colEl);
    });

    el.workspace.appendChild(kanbanGrid);
  }

  function setupEventListeners() {
    if (el.formCreate) {
      el.formCreate.addEventListener('submit', async e => {
        e.preventDefault();
        const title = el.inputTitle.value.trim();
        if (!title) return;

        await createTodo({
          title,
          category: el.selectCategory ? el.selectCategory.value : 'Work',
          priority: el.selectPriority ? el.selectPriority.value : 'medium',
          due_date: el.inputDueDate ? el.inputDueDate.value : '',
          pinned: el.checkPinned ? el.checkPinned.checked : false,
          status: 'todo',
          notes: '',
          subtasks: [],
        });

        el.inputTitle.value = '';
        if (el.checkPinned) el.checkPinned.checked = false;
        if (el.inputDueDate) el.inputDueDate.value = '';
      });
    }

    document.querySelectorAll('[data-view], [data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        btn.classList.add('active');
        state.currentView = btn.getAttribute('data-view') || btn.getAttribute('data-category');
        render();
      });
    });

    if (el.inputSearch) {
      el.inputSearch.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        render();
      });
    }

    if (el.selectFilterPriority) {
      el.selectFilterPriority.addEventListener('change', e => {
        state.filterPriority = e.target.value;
        render();
      });
    }

    if (el.selectSort) {
      el.selectSort.addEventListener('change', e => {
        state.sortBy = e.target.value;
        render();
      });
    }

    if (el.btnViewList) {
      el.btnViewList.addEventListener('click', () => {
        state.viewType = 'list';
        render();
      });
    }

    if (el.btnViewKanban) {
      el.btnViewKanban.addEventListener('click', () => {
        state.viewType = 'kanban';
        render();
      });
    }

    if (el.btnClearCompleted) {
      el.btnClearCompleted.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all completed tasks?')) {
          clearCompleted();
        }
      });
    }

    if (el.workspace) {
      el.workspace.addEventListener('click', async e => {
        const toggleBtn = e.target.closest('.btn-toggle-complete');
        if (toggleBtn) {
          const id = toggleBtn.getAttribute('data-id');
          const todo = state.todos.find(t => t.id === id);
          if (todo) {
            const newStatus = todo.completed ? 'todo' : 'done';
            await updateTodo(id, { completed: !todo.completed, status: newStatus });
          }
          return;
        }

        const pinBtn = e.target.closest('.btn-toggle-pin');
        if (pinBtn) {
          const id = pinBtn.getAttribute('data-id');
          const todo = state.todos.find(t => t.id === id);
          if (todo) await updateTodo(id, { pinned: !todo.pinned });
          return;
        }

        const deleteBtn = e.target.closest('.btn-delete-task');
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-id');
          if (confirm('Delete this task permanently?')) await deleteTodo(id);
          return;
        }

        const editBtn = e.target.closest('.btn-edit-task');
        if (editBtn) {
          const id = editBtn.getAttribute('data-id');
          openEditModal(id);
          return;
        }

        const subtaskCheck = e.target.closest('.btn-toggle-subtask');
        if (subtaskCheck) {
          const id = subtaskCheck.getAttribute('data-id');
          const index = parseInt(subtaskCheck.getAttribute('data-index'), 10);
          const todo = state.todos.find(t => t.id === id);
          if (todo && todo.subtasks[index]) {
            const updatedSubtasks = [...todo.subtasks];
            updatedSubtasks[index].completed = subtaskCheck.checked;
            await updateTodo(id, { subtasks: updatedSubtasks });
          }
          return;
        }

        const stageBtn = e.target.closest('.btn-move-stage');
        if (stageBtn) {
          const id = stageBtn.getAttribute('data-id');
          const target = stageBtn.getAttribute('data-target');
          const todo = state.todos.find(t => t.id === id);
          if (todo) {
            const stages = ['todo', 'in_progress', 'done'];
            let curIdx = stages.indexOf(todo.status);
            if (target === 'next' && curIdx < 2) curIdx++;
            if (target === 'prev' && curIdx > 0) curIdx--;
            const nextStage = stages[curIdx];
            await updateTodo(id, { status: nextStage, completed: nextStage === 'done' });
          }
          return;
        }

        const attachTimerBtn = e.target.closest('.btn-attach-timer');
        if (attachTimerBtn) {
          const id = attachTimerBtn.getAttribute('data-id');
          const todo = state.todos.find(t => t.id === id);
          if (todo) {
            state.activeTimerTask = todo;
            if (el.timerTaskTitle) el.timerTaskTitle.textContent = todo.title;
            showToast(`Timer attached: ${todo.title}`, 'info');
          }
        }
      });
    }

    function openEditModal(id) {
      const todo = state.todos.find(t => t.id === id);
      if (!todo || !el.modalEdit) return;

      if (el.editId) el.editId.value = todo.id;
      if (el.editTitle) el.editTitle.value = todo.title;
      if (el.editNotes) el.editNotes.value = todo.notes || '';
      if (el.editCategory) el.editCategory.value = todo.category || 'Work';
      if (el.editPriority) el.editPriority.value = todo.priority || 'medium';
      if (el.editStatus) el.editStatus.value = todo.status || 'todo';
      if (el.editDue) el.editDue.value = todo.due_date || '';

      state.editingSubtasks = Array.isArray(todo.subtasks) ? JSON.parse(JSON.stringify(todo.subtasks)) : [];
      renderModalSubtasks();

      el.modalEdit.classList.remove('hidden');
    }

    function renderModalSubtasks() {
      if (!el.editSubtasksList) return;
      el.editSubtasksList.innerHTML = '';
      state.editingSubtasks.forEach((st, idx) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-2 bg-[var(--bg-elevated)] p-1.5 rounded text-xs';
        row.innerHTML = `
          <div class="flex items-center gap-2 flex-1">
            <input type="checkbox" ${st.completed ? 'checked' : ''} class="modal-subtask-check" data-idx="${idx}">
            <span class="${st.completed ? 'line-through text-[var(--text-secondary)]' : ''}">${escapeHtml(st.text)}</span>
          </div>
          <button type="button" class="btn-remove-subtask text-rose-400" data-idx="${idx}">✕</button>
        `;
        el.editSubtasksList.appendChild(row);
      });
    }

    if (el.btnAddSubtask) {
      el.btnAddSubtask.addEventListener('click', () => {
        const txt = el.inputNewSubtask ? el.inputNewSubtask.value.trim() : '';
        if (txt) {
          state.editingSubtasks.push({ text: txt, completed: false });
          if (el.inputNewSubtask) el.inputNewSubtask.value = '';
          renderModalSubtasks();
        }
      });
    }

    if (el.editSubtasksList) {
      el.editSubtasksList.addEventListener('click', e => {
        const check = e.target.closest('.modal-subtask-check');
        if (check) {
          const idx = parseInt(check.getAttribute('data-idx'), 10);
          state.editingSubtasks[idx].completed = check.checked;
          renderModalSubtasks();
          return;
        }
        const rm = e.target.closest('.btn-remove-subtask');
        if (rm) {
          const idx = parseInt(rm.getAttribute('data-idx'), 10);
          state.editingSubtasks.splice(idx, 1);
          renderModalSubtasks();
        }
      });
    }

    if (el.btnCloseEdit) el.btnCloseEdit.addEventListener('click', () => el.modalEdit.classList.add('hidden'));
    if (el.btnCancelEdit) el.btnCancelEdit.addEventListener('click', () => el.modalEdit.classList.add('hidden'));

    if (el.formEdit) {
      el.formEdit.addEventListener('submit', async e => {
        e.preventDefault();
        const id = el.editId.value;
        await updateTodo(id, {
          title: el.editTitle.value.trim(),
          notes: el.editNotes.value.trim(),
          category: el.editCategory.value,
          priority: el.editPriority.value,
          status: el.editStatus.value,
          due_date: el.editDue.value,
          completed: el.editStatus.value === 'done',
          subtasks: state.editingSubtasks,
        });
        el.modalEdit.classList.add('hidden');
        showToast('Task updated successfully', 'success');
      });
    }

    if (el.btnTimerStart) {
      el.btnTimerStart.addEventListener('click', () => {
        if (state.timer.isRunning) {
          clearInterval(state.timer.intervalId);
          state.timer.isRunning = false;
          el.btnTimerStart.textContent = 'Start';
        } else {
          state.timer.isRunning = true;
          el.btnTimerStart.textContent = 'Pause';
          state.timer.intervalId = setInterval(() => {
            if (state.timer.timeLeft > 0) {
              state.timer.timeLeft--;
              updateTimerDisplay();
            } else {
              clearInterval(state.timer.intervalId);
              state.timer.isRunning = false;
              showToast('Session finished!', 'success');
              el.btnTimerStart.textContent = 'Start';
            }
          }, 1000);
        }
      });
    }

    if (el.btnTimerReset) {
      el.btnTimerReset.addEventListener('click', () => {
        clearInterval(state.timer.intervalId);
        state.timer.isRunning = false;
        state.timer.timeLeft = 25 * 60;
        if (el.btnTimerStart) el.btnTimerStart.textContent = 'Start';
        updateTimerDisplay();
      });
    }

    function updateTimerDisplay() {
      if (!el.timerDisplay) return;
      const m = Math.floor(state.timer.timeLeft / 60).toString().padStart(2, '0');
      const s = (state.timer.timeLeft % 60).toString().padStart(2, '0');
      el.timerDisplay.textContent = `${m}:${s}`;
    }

    if (el.btnPhpApiModal) el.btnPhpApiModal.addEventListener('click', () => el.modalPhpApi.classList.remove('hidden'));
    if (el.btnCloseApiModal) el.btnCloseApiModal.addEventListener('click', () => el.modalPhpApi.classList.add('hidden'));

    if (el.btnExportJson) {
      el.btnExportJson.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.todos, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "taskflow_todos_export.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      });
    }

    if (el.btnThemeToggle) {
      el.btnThemeToggle.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
      });
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadTodos();
  });
})();
