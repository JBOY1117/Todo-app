# Todo-app# TaskFlow — Full-Stack Modern To-Do Workspace (HTML, CSS, JavaScript & PHP)

A modern, full-featured task management and productivity application built with semantic **HTML5**, custom **CSS3** (with Tailwind utilities), vanilla **ES6+ JavaScript**, and a **PHP 8+ REST API** powered by **PDO SQLite** (with an automatic JSON file fallback).

## Key Features

- **Dual-Engine Persistence (`api.php` + Local Fallback)**:
  - Uses PHP PDO with SQLite (`data/todos.sqlite`) out of the box and automatically falls back to `data/todos.json` if `pdo_sqlite` is disabled.
  - Gracefully operates in client-side mode if previewed statically without a running PHP server.
- **Rich Task Management (Full CRUD)**:
  - Create, edit, complete, pin/star, and delete tasks with notes, due dates, priority levels (`High`, `Medium`, `Low`), workflow status (`To Do`, `In Progress`, `Done`), and categories (`Engineering`, `Design`, `Work`, `Personal`, `Errands`).
  - Interactive **Subtasks / Checklists** inside any task card with live progress indicators.
- **List View & Interactive Kanban Board**:
  - Switch seamlessly between a detailed **List View** and a 3-column **Kanban Board** (`To Do`, `In Progress`, `Completed`) with one-click stage transitions.
- **Smart Filtering, Live Search & Sorting**:
  - Filter by Smart Views (`All Tasks`, `Due Today`, `Upcoming`, `Pinned`, `Completed`), Category, or Priority.
  - Instant search across task titles, notes, and subtasks, plus multi-criteria sorting.
- **Built-in Focus Timer (Pomodoro)**:
  - Attach any task to the 25-minute / 5-minute break timer in the sidebar to track deep-work sessions.
- **PHP API Inspector & JSON Import/Export**:
  - Inspect live PHP endpoint schemas, copy `cURL` commands, and export or import your task database as JSON.

## Quick Start (Local PHP Server)

1. Start the built-in PHP development server:
   ```bash
   php -S localhost:8000
   ```
2. Open `http://localhost:8000` in your browser.

## PHP REST API Endpoints (`api.php`)

- `GET api.php?action=list` — Returns all tasks, active storage engine (`sqlite` or `json`), and PHP version
- `POST api.php?action=create` — Creates a new task (`title`, `notes`, `category`, `priority`, `status`, `due_date`, `pinned`, `subtasks`)
- `POST api.php?action=update` — Updates any task fields or subtask arrays by `id`
- `POST api.php?action=toggle` — Toggles completion status for a task by `id`
- `POST api.php?action=delete` — Permanently deletes a task by `id`
- `POST api.php?action=clear_completed` — Removes all completed tasks and returns the updated list
