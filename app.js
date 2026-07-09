/* ============================================================================
   ADVANCED APPLICATION STATE & CONSTANTS
   ============================================================================ */

const STORAGE_KEY = "algoTrackerAdvanced";
const SESSION_STORAGE_KEY = "algoTrackerSessions";
const THEME_STORAGE_KEY = "algoTrackerTheme";
const POMODORO_DURATION = {
  15: 15 * 60,
  25: 25 * 60,
  45: 45 * 60,
};

const TASK_STATUSES = {
  TODO: "todo",
  IN_PROGRESS: "inProgress",
  MASTERED: "mastered",
};

const DIFFICULTIES = ["easy", "medium", "hard"];
const PRIORITIES = ["low", "medium", "high"];

let appState = {
  tasks: [],
  timerRunning: false,
  timerRemaining: POMODORO_DURATION[25],
  timerDuration: 25,
  currentDraggedTask: null,
  editingTaskId: null,
  sessionsToday: 0,
  focusTimeToday: 0,
  allSessions: [],
  filterDifficulty: "all",
  filterCategory: "",
  searchQuery: "",
};

let timerInterval = null;
let timerStartTime = null;

/* ============================================================================
   LOCAL STORAGE MANAGEMENT
   ============================================================================ */

function loadTasksFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading tasks:", error);
    return [];
  }
}

function saveTasksToStorage(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Error saving tasks:", error);
  }
}

function loadSessionsFromStorage() {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading sessions:", error);
    return [];
  }
}

function saveSessionsToStorage(sessions) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Error saving sessions:", error);
  }
}

function generateTaskId() {
  return Date.now();
}

/* ============================================================================
   THEME MANAGEMENT
   ============================================================================ */

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    console.error("Error loading theme:", error);
    return null;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const toggleBtn = document.getElementById("theme-toggle");
  const icon = toggleBtn?.querySelector(".theme-icon");
  if (icon) {
    icon.textContent = theme === "light" ? "☀️" : "🌙";
  }
  if (toggleBtn) {
    toggleBtn.setAttribute(
      "aria-label",
      theme === "light" ? "Switch to dark theme" : "Switch to light theme"
    );
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error("Error saving theme:", error);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

function initializeTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") {
    applyTheme(stored);
    return;
  }
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  applyTheme(prefersLight ? "light" : "dark");
}

/* ============================================================================
   DOM RENDERING & FILTERING
   ============================================================================ */

function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.dataset.status = task.status;

  const header = document.createElement("div");
  header.className = "task-header";

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;
  title.title = task.title;

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "task-edit-btn";
  editBtn.innerHTML = "✏️";
  editBtn.setAttribute("aria-label", `Edit task: ${task.title}`);
  editBtn.addEventListener("click", () => openTaskModal(task));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "task-delete-btn";
  deleteBtn.innerHTML = "🗑️";
  deleteBtn.setAttribute("aria-label", `Delete task: ${task.title}`);
  deleteBtn.addEventListener("click", () => deleteTask(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  header.appendChild(title);
  header.appendChild(actions);

  const meta = document.createElement("div");
  meta.className = "task-meta";

  if (task.difficulty) {
    const diffBadge = document.createElement("span");
    diffBadge.className = `task-badge ${task.difficulty}`;
    diffBadge.textContent = task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1);
    meta.appendChild(diffBadge);
  }

  if (task.priority && task.priority !== "medium") {
    const prioBadge = document.createElement("span");
    prioBadge.className = `task-badge priority-${task.priority}`;
    prioBadge.textContent = "⚡ " + task.priority.toUpperCase();
    meta.appendChild(prioBadge);
  }

  if (task.category) {
    const catBadge = document.createElement("span");
    catBadge.className = "task-badge";
    catBadge.textContent = task.category.toUpperCase();
    meta.appendChild(catBadge);
  }

  card.appendChild(header);
  if (meta.children.length > 0) {
    card.appendChild(meta);
  }

  card.addEventListener("dragstart", handleDragStart);
  card.addEventListener("dragend", handleDragEnd);

  return card;
}

function filterTasks(tasks) {
  return tasks.filter((task) => {
    let matches = true;

    if (appState.filterDifficulty !== "all" && task.difficulty !== appState.filterDifficulty) {
      matches = false;
    }

    if (appState.filterCategory && task.category !== appState.filterCategory) {
      matches = false;
    }

    if (appState.searchQuery) {
      const query = appState.searchQuery.toLowerCase();
      if (!task.title.toLowerCase().includes(query)) {
        matches = false;
      }
    }

    return matches;
  });
}

function renderTasks() {
  Object.values(TASK_STATUSES).forEach((status) => {
    const container = document.getElementById(`column-${status}`);
    if (container) {
      container.innerHTML = "";
    }
  });

  const filteredTasks = filterTasks(appState.tasks);

  filteredTasks.forEach((task) => {
    const container = document.getElementById(`column-${task.status}`);
    if (container) {
      container.appendChild(createTaskCard(task));
    }
  });

  updateColumnCounts();
  updateAnalytics();
}

function updateColumnCounts() {
  Object.values(TASK_STATUSES).forEach((status) => {
    const count = appState.tasks.filter((task) => task.status === status).length;
    const countElement = document.getElementById(`count-${status}`);
    if (countElement) {
      countElement.textContent = count;
    }
  });
}

/* ============================================================================
   KANBAN BOARD OPERATIONS
   ============================================================================ */

function addTask(title, difficulty = "medium", priority = "medium", category = "") {
  if (!title.trim()) return;

  const newTask = {
    id: generateTaskId(),
    title: title.trim(),
    status: TASK_STATUSES.TODO,
    difficulty,
    priority,
    category,
    description: "",
    createdAt: new Date().toISOString(),
  };

  appState.tasks.push(newTask);
  saveTasksToStorage(appState.tasks);
  renderTasks();

  const input = document.getElementById("new-task-input");
  if (input) {
    input.value = "";
    input.focus();
  }
}

function updateTask(taskId, updates) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (task) {
    Object.assign(task, updates);
    saveTasksToStorage(appState.tasks);
    renderTasks();
  }
}

function deleteTask(taskId) {
  appState.tasks = appState.tasks.filter((task) => task.id !== taskId);
  saveTasksToStorage(appState.tasks);
  renderTasks();
}

function updateTaskStatus(taskId, newStatus) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (task && Object.values(TASK_STATUSES).includes(newStatus)) {
    task.status = newStatus;
    saveTasksToStorage(appState.tasks);
    
    // Trigger confetti if moved to mastered
    if (newStatus === TASK_STATUSES.MASTERED) {
      createConfetti();
    }
    
    renderTasks();
  }
}

/* ============================================================================
   DRAG AND DROP
   ============================================================================ */

function handleDragStart(event) {
  const taskId = parseInt(event.target.closest(".task-card").dataset.taskId);
  appState.currentDraggedTask = taskId;
  event.target.closest(".task-card").classList.add("drag-source");
  event.dataTransfer.effectAllowed = "move";
}

function handleDragEnd(event) {
  event.target.closest(".task-card").classList.remove("drag-source");
  appState.currentDraggedTask = null;
  document.querySelectorAll(".card-container").forEach((container) => {
    container.classList.remove("drag-over");
  });
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("drag-over");
}

function handleDragLeave(event) {
  if (event.currentTarget === event.target) {
    event.currentTarget.classList.remove("drag-over");
  }
}

function handleDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");

  if (appState.currentDraggedTask) {
    const newStatus = event.currentTarget.dataset.status;
    updateTaskStatus(appState.currentDraggedTask, newStatus);
  }
}

/* ============================================================================
   TASK MODAL
   ============================================================================ */

function openTaskModal(task = null) {
  const modal = document.getElementById("modal-task-details");
  const titleInput = document.getElementById("modal-title-input");
  const diffSelect = document.getElementById("modal-difficulty-select");
  const prioSelect = document.getElementById("modal-priority-select");
  const catSelect = document.getElementById("modal-category-select");
  const descInput = document.getElementById("modal-description-input");

  if (task) {
    appState.editingTaskId = task.id;
    document.getElementById("modal-task-title").textContent = "Edit Task";
    titleInput.value = task.title;
    diffSelect.value = task.difficulty || "medium";
    prioSelect.value = task.priority || "medium";
    catSelect.value = task.category || "";
    descInput.value = task.description || "";
  } else {
    appState.editingTaskId = null;
    document.getElementById("modal-task-title").textContent = "New Task";
    titleInput.value = "";
    diffSelect.value = "medium";
    prioSelect.value = "medium";
    catSelect.value = "";
    descInput.value = "";
  }

  modal.classList.remove("hidden");
  titleInput.focus();
}

function closeTaskModal() {
  const modal = document.getElementById("modal-task-details");
  modal.classList.add("hidden");
  appState.editingTaskId = null;
}

function saveTaskModal() {
  const titleInput = document.getElementById("modal-title-input");
  const diffSelect = document.getElementById("modal-difficulty-select");
  const prioSelect = document.getElementById("modal-priority-select");
  const catSelect = document.getElementById("modal-category-select");
  const descInput = document.getElementById("modal-description-input");

  if (!titleInput.value.trim()) return;

  if (appState.editingTaskId) {
    updateTask(appState.editingTaskId, {
      title: titleInput.value.trim(),
      difficulty: diffSelect.value,
      priority: prioSelect.value,
      category: catSelect.value,
      description: descInput.value,
    });
  } else {
    addTask(
      titleInput.value,
      diffSelect.value,
      prioSelect.value,
      catSelect.value
    );
  }

  closeTaskModal();
}

/* ============================================================================
   POMODORO TIMER
   ============================================================================ */

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateTimerDisplay(remaining) {
  const timeDisplay = document.getElementById("timer-display");
  if (timeDisplay) {
    timeDisplay.textContent = formatTime(remaining);
  }

  const circumference = 2 * Math.PI * 54;
  const progress = remaining / (POMODORO_DURATION[appState.timerDuration] || POMODORO_DURATION[25]);
  const offset = circumference * (1 - progress);

  const progressCircle = document.querySelector(".timer-circle-progress");
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = offset;
  }
}

function startTimer() {
  if (appState.timerRunning) return;

  appState.timerRunning = true;
  timerStartTime = Date.now();
  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");

  if (btnStart) btnStart.disabled = true;
  if (btnPause) btnPause.disabled = false;

  timerInterval = setInterval(() => {
    appState.timerRemaining--;

    if (appState.timerRemaining <= 0) {
      clearInterval(timerInterval);
      appState.timerRunning = false;
      appState.timerRemaining = 0;
      updateTimerDisplay(0);

      if (btnStart) btnStart.disabled = false;
      if (btnPause) btnPause.disabled = true;

      recordSession();
      playTimerNotification();
      createConfetti();
    } else {
      updateTimerDisplay(appState.timerRemaining);
    }
  }, 1000);
}

function pauseTimer() {
  if (!appState.timerRunning) return;

  appState.timerRunning = false;
  clearInterval(timerInterval);

  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");

  if (btnStart) btnStart.disabled = false;
  if (btnPause) btnPause.disabled = true;
}

function resetTimer() {
  if (appState.timerRunning) {
    clearInterval(timerInterval);
  }

  appState.timerRunning = false;
  appState.timerRemaining = POMODORO_DURATION[appState.timerDuration] || POMODORO_DURATION[25];

  updateTimerDisplay(appState.timerRemaining);

  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");

  if (btnStart) btnStart.disabled = false;
  if (btnPause) btnPause.disabled = true;
}

function setTimerDuration(minutes) {
  appState.timerDuration = minutes;
  resetTimer();

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (parseInt(btn.dataset.duration) === minutes) {
      btn.classList.add("active");
    }
  });
}

function recordSession() {
  const duration = POMODORO_DURATION[appState.timerDuration] || POMODORO_DURATION[25];
  const session = {
    id: Date.now(),
    duration,
    completedAt: new Date().toISOString(),
  };

  appState.allSessions.push(session);
  saveSessionsToStorage(appState.allSessions);

  appState.sessionsToday++;
  appState.focusTimeToday += Math.floor(duration / 60);

  updateSessionStats();
}

function playTimerNotification() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log("Audio notification unavailable");
  }
}

/* ============================================================================
   ANALYTICS & SESSION TRACKING
   ============================================================================ */

function updateAnalytics() {
  const totalTasks = appState.tasks.length;
  const masteredTasks = appState.tasks.filter(
    (task) => task.status === TASK_STATUSES.MASTERED
  ).length;
  const inProgressTasks = appState.tasks.filter(
    (task) => task.status === TASK_STATUSES.IN_PROGRESS
  ).length;
  const masteredPercent = totalTasks === 0 ? 0 : Math.round((masteredTasks / totalTasks) * 100);

  document.getElementById("total-tasks").textContent = totalTasks;
  document.getElementById("mastered-tasks").textContent = masteredTasks;
  document.getElementById("progress-tasks").textContent = inProgressTasks;

  const progressBar = document.getElementById("progress-bar");
  if (progressBar) {
    progressBar.style.width = `${masteredPercent}%`;
  }

  document.getElementById("progress-percent").textContent = `${masteredPercent}%`;

  const chartCircle = document.getElementById("chart-circle");
  if (chartCircle) {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference * (1 - masteredPercent / 100);
    chartCircle.style.strokeDashoffset = offset;
  }
}

function updateSessionStats() {
  document.getElementById("sessions-today").textContent = appState.sessionsToday;
  document.getElementById("focus-time-today").textContent = appState.focusTimeToday + "m";
  document.getElementById("session-count").textContent = appState.allSessions.length;

  const totalHours = Math.floor(
    appState.allSessions.reduce((sum, s) => sum + s.duration, 0) / 3600
  );
  document.getElementById("focus-hours").textContent = totalHours + "h";
}

function openStatsModal() {
  const modal = document.getElementById("modal-stats");
  const sessions = appState.allSessions;

  const totalSessions = sessions.length;
  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const avgDuration = totalSessions === 0 ? 0 : Math.floor(totalSeconds / totalSessions / 60);
  const maxDuration = sessions.length === 0 ? 0 : Math.max(...sessions.map((s) => s.duration)) / 60;

  document.getElementById("stat-total-sessions").textContent = totalSessions;
  document.getElementById("stat-total-hours").textContent = totalHours + "h";
  document.getElementById("stat-avg-duration").textContent = avgDuration + "m";
  document.getElementById("stat-longest-session").textContent = Math.floor(maxDuration) + "m";

  // Difficulty distribution
  const diffChart = document.getElementById("difficulty-chart");
  diffChart.innerHTML = "";

  const difficulties = {
    easy: appState.tasks.filter((t) => t.difficulty === "easy").length,
    medium: appState.tasks.filter((t) => t.difficulty === "medium").length,
    hard: appState.tasks.filter((t) => t.difficulty === "hard").length,
  };

  const maxDiff = Math.max(...Object.values(difficulties), 1);

  Object.entries(difficulties).forEach(([level, count]) => {
    const bar = document.createElement("div");
    bar.className = `difficulty-bar difficulty-bar-${level}`;

    const label = document.createElement("div");
    label.className = "difficulty-label";
    label.textContent = level.charAt(0).toUpperCase() + level.slice(1);

    const barFill = document.createElement("div");
    barFill.className = "difficulty-bar-fill";

    const barValue = document.createElement("div");
    barValue.className = "difficulty-bar-value";
    barValue.style.width = `${(count / maxDiff) * 100}%`;
    barValue.textContent = count;

    barFill.appendChild(barValue);
    bar.appendChild(label);
    bar.appendChild(barFill);
    diffChart.appendChild(bar);
  });

  modal.classList.remove("hidden");
}

function closeStatsModal() {
  document.getElementById("modal-stats").classList.add("hidden");
}

/* ============================================================================
   SEARCH & FILTER
   ============================================================================ */

function toggleSearchBar() {
  const searchBar = document.getElementById("search-bar");
  searchBar.classList.toggle("hidden");
  if (!searchBar.classList.contains("hidden")) {
    document.getElementById("search-input").focus();
  }
}

function toggleFilterBar() {
  const filterBar = document.getElementById("filter-bar");
  filterBar.classList.toggle("hidden");
}

function applyFilters() {
  renderTasks();
}

/* ============================================================================
   CONFETTI ANIMATION
   ============================================================================ */

function createConfetti() {
  const container = document.getElementById("confetti-container");
  const colors = [
    "var(--color-accent-purple)",
    "var(--color-accent-green)",
    "var(--color-accent-blue)",
    "var(--color-accent-pink)",
  ];
  const colorClasses = ["", "green", "blue", "pink"];

  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement("div");
    confetti.className = `confetti ${colorClasses[Math.floor(Math.random() * colorClasses.length)]}`;
    confetti.style.left = Math.random() * 100 + "%";
    confetti.style.top = "-10px";
    confetti.style.opacity = Math.random() * 0.7 + 0.3;

    container.appendChild(confetti);

    setTimeout(() => confetti.remove(), 3000);
  }
}

/* ============================================================================
   KEYBOARD SHORTCUTS
   ============================================================================ */

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    // Ctrl/Cmd + K: Search
    if ((event.ctrlKey || event.metaKey) && event.key === "k") {
      event.preventDefault();
      toggleSearchBar();
    }

    // Ctrl/Cmd + N: New Task
    if ((event.ctrlKey || event.metaKey) && event.key === "n") {
      event.preventDefault();
      openTaskModal();
    }

    // Space: Toggle Timer
    if (event.code === "Space" && !event.target.matches("input, textarea")) {
      event.preventDefault();
      if (appState.timerRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    }

    // Escape: Close modals
    if (event.key === "Escape") {
      document.getElementById("modal-task-details").classList.add("hidden");
      document.getElementById("modal-stats").classList.add("hidden");
      if (!document.getElementById("search-bar").classList.contains("hidden")) {
        toggleSearchBar();
      }
      if (!document.getElementById("filter-bar").classList.contains("hidden")) {
        toggleFilterBar();
      }
    }
  });
}

/* ============================================================================
   EVENT LISTENERS SETUP
   ============================================================================ */

function setupEventListeners() {
  // Theme Toggle
  document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);

  // Add Task
  const btnAddTask = document.getElementById("btn-add-task");
  if (btnAddTask) {
    btnAddTask.addEventListener("click", () => {
      const input = document.getElementById("new-task-input");
      if (input && input.value.trim()) {
        addTask(input.value);
      }
    });
  }

  const inputNewTask = document.getElementById("new-task-input");
  if (inputNewTask) {
    inputNewTask.addEventListener("keypress", (event) => {
      if (event.key === "Enter" && event.target.value.trim()) {
        addTask(event.target.value);
      }
    });
  }

  // Drag & Drop
  document.querySelectorAll(".card-container").forEach((container) => {
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("dragleave", handleDragLeave);
    container.addEventListener("drop", handleDrop);
  });

  // Timer Controls
  document.getElementById("btn-start")?.addEventListener("click", startTimer);
  document.getElementById("btn-pause")?.addEventListener("click", pauseTimer);
  document.getElementById("btn-reset")?.addEventListener("click", resetTimer);

  // Timer Presets
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setTimerDuration(parseInt(btn.dataset.duration));
    });
  });

  // Task Modal
  const btnModal = document.getElementById("btn-modal-save");
  const btnCancel = document.getElementById("btn-modal-cancel");
  const btnClose = document.querySelector(".modal-task-details .btn-modal-close");

  btnModal?.addEventListener("click", saveTaskModal);
  btnCancel?.addEventListener("click", closeTaskModal);
  btnClose?.addEventListener("click", closeTaskModal);

  // Stats Modal
  document.getElementById("btn-stats")?.addEventListener("click", openStatsModal);
  document.getElementById("btn-stats-close")?.addEventListener("click", closeStatsModal);
  document.querySelector(".modal-stats .btn-modal-close")?.addEventListener("click", closeStatsModal);

  // Search
  document.getElementById("btn-search")?.addEventListener("click", toggleSearchBar);
  document.getElementById("search-input")?.addEventListener("input", (e) => {
    appState.searchQuery = e.target.value;
    applyFilters();
  });
  document.querySelector(".btn-close-search")?.addEventListener("click", toggleSearchBar);

  // Filter
  document.getElementById("btn-filter")?.addEventListener("click", toggleFilterBar);

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      appState.filterDifficulty = e.target.dataset.filter;
      applyFilters();
    });
  });

  document.getElementById("category-select")?.addEventListener("change", (e) => {
    appState.filterCategory = e.target.value;
    applyFilters();
  });

  // Close modals on outside click
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  });
}

/* ============================================================================
   APPLICATION INITIALIZATION
   ============================================================================ */

function initializeApp() {
  initializeTheme();

  appState.tasks = loadTasksFromStorage();
  appState.allSessions = loadSessionsFromStorage();

  renderTasks();
  updateTimerDisplay(appState.timerRemaining);
  updateSessionStats();

  setupEventListeners();
  setupKeyboardShortcuts();

  console.log("✓ AlgoTracker Pro initialized");
}

document.addEventListener("DOMContentLoaded", initializeApp);
window.addEventListener("beforeunload", () => {
  saveTasksToStorage(appState.tasks);
  saveSessionsToStorage(appState.allSessions);
});
