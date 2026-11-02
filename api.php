<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

class TodoRepository
{
    private ?PDO $pdo = null;
    private string $jsonFile;
    private string $engine = 'json';

    public function __construct(string $dataDir)
    {
        $this->jsonFile = $dataDir . '/todos.json';
        $sqliteFile = $dataDir . '/todos.sqlite';

        if (extension_loaded('pdo_sqlite')) {
            try {
                $this->pdo = new PDO('sqlite:' . $sqliteFile, null, null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]);
                $this->engine = 'sqlite';
                $this->initializeSqlite();
                return;
            } catch (Throwable $e) {
                $this->pdo = null;
                $this->engine = 'json';
            }
        }
        $this->initializeJson();
    }

    public function getEngine(): string
    {
        return $this->engine;
    }

    private function initializeSqlite(): void
    {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS todos (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                notes TEXT DEFAULT '',
                category TEXT DEFAULT 'Work',
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'todo',
                completed INTEGER DEFAULT 0,
                pinned INTEGER DEFAULT 0,
                due_date TEXT DEFAULT '',
                subtasks TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ");
    }

    private function initializeJson(): void
    {
        if (!file_exists($this->jsonFile)) {
            file_put_contents($this->jsonFile, json_encode([], JSON_PRETTY_PRINT), LOCK_EX);
        }
    }

    private function normalizeRow(array $row): array
    {
        $subtasks = $row['subtasks'] ?? [];
        if (is_string($subtasks)) {
            $decoded = json_decode($subtasks, true);
            $subtasks = is_array($decoded) ? $decoded : [];
        }
        $completed = !empty($row['completed']);
        $status = $row['status'] ?? ($completed ? 'done' : 'todo');
        return [
            'id' => (string) $row['id'],
            'title' => (string) $row['title'],
            'notes' => (string) ($row['notes'] ?? ''),
            'category' => (string) ($row['category'] ?? 'Work'),
            'priority' => (string) ($row['priority'] ?? 'medium'),
            'status' => (string) $status,
            'completed' => $completed,
            'pinned' => !empty($row['pinned']),
            'due_date' => (string) ($row['due_date'] ?? ''),
            'subtasks' => array_values($subtasks),
            'created_at' => (string) ($row['created_at'] ?? gmdate('c')),
            'updated_at' => (string) ($row['updated_at'] ?? gmdate('c')),
        ];
    }

    public function listAll(): array
    {
        if ($this->pdo) {
            $stmt = $this->pdo->query("SELECT * FROM todos ORDER BY pinned DESC, completed ASC, created_at DESC");
            return array_map([$this, 'normalizeRow'], $stmt->fetchAll());
        }
        $raw = file_exists($this->jsonFile) ? file_get_contents($this->jsonFile) : '[]';
        $items = json_decode($raw ?: '[]', true);
        return array_map([$this, 'normalizeRow'], is_array($items) ? $items : []);
    }

    private function saveJsonAll(array $items): void
    {
        file_put_contents($this->jsonFile, json_encode(array_values($items), JSON_PRETTY_PRINT), LOCK_EX);
    }

    public function create(array $payload): array
    {
        $now = gmdate('c');
        $status = $payload['status'] ?? 'todo';
        $completed = !empty($payload['completed']) || $status === 'done';
        $todo = [
            'id' => 'tsk_' . bin2hex(random_bytes(5)),
            'title' => trim((string) ($payload['title'] ?? '')),
            'notes' => trim((string) ($payload['notes'] ?? '')),
            'category' => trim((string) ($payload['category'] ?? 'Work')),
            'priority' => in_array($payload['priority'] ?? 'medium', ['low', 'medium', 'high'], true) ? $payload['priority'] : 'medium',
            'status' => in_array($status, ['todo', 'in_progress', 'done'], true) ? $status : 'todo',
            'completed' => $completed,
            'pinned' => !empty($payload['pinned']),
            'due_date' => trim((string) ($payload['due_date'] ?? '')),
            'subtasks' => is_array($payload['subtasks'] ?? null) ? $payload['subtasks'] : [],
            'created_at' => $now,
            'updated_at' => $now,
        ];

        if ($this->pdo) {
            $stmt = $this->pdo->prepare("
                INSERT INTO todos (id, title, notes, category, priority, status, completed, pinned, due_date, subtasks, created_at, updated_at)
                VALUES (:id, :title, :notes, :category, :priority, :status, :completed, :pinned, :due_date, :subtasks, :created_at, :updated_at)
            ");
            $stmt->execute([
                ':id' => $todo['id'],
                ':title' => $todo['title'],
                ':notes' => $todo['notes'],
                ':category' => $todo['category'],
                ':priority' => $todo['priority'],
                ':status' => $todo['status'],
                ':completed' => $todo['completed'] ? 1 : 0,
                ':pinned' => $todo['pinned'] ? 1 : 0,
                ':due_date' => $todo['due_date'],
                ':subtasks' => json_encode($todo['subtasks']),
                ':created_at' => $todo['created_at'],
                ':updated_at' => $todo['updated_at'],
            ]);
        } else {
            $items = $this->listAll();
            array_unshift($items, $todo);
            $this->saveJsonAll($items);
        }
        return $this->normalizeRow($todo);
    }

    public function update(string $id, array $payload): ?array
    {
        $items = $this->listAll();
        $existing = null;
        foreach ($items as $item) {
            if ($item['id'] === $id) {
                $existing = $item;
                break;
            }
        }
        if (!$existing) return null;

        $status = isset($payload['status']) ? (string) $payload['status'] : $existing['status'];
        $completed = isset($payload['completed']) ? (bool) $payload['completed'] : ($status === 'done');

        $updated = [
            'id' => $id,
            'title' => isset($payload['title']) && trim((string)$payload['title']) !== '' ? trim((string)$payload['title']) : $existing['title'],
            'notes' => isset($payload['notes']) ? trim((string) $payload['notes']) : $existing['notes'],
            'category' => isset($payload['category']) ? trim((string) $payload['category']) : $existing['category'],
            'priority' => isset($payload['priority']) ? (string) $payload['priority'] : $existing['priority'],
            'status' => $status,
            'completed' => $completed,
            'pinned' => isset($payload['pinned']) ? (bool) $payload['pinned'] : $existing['pinned'],
            'due_date' => isset($payload['due_date']) ? trim((string) $payload['due_date']) : $existing['due_date'],
            'subtasks' => isset($payload['subtasks']) && is_array($payload['subtasks']) ? $payload['subtasks'] : $existing['subtasks'],
            'created_at' => $existing['created_at'],
            'updated_at' => gmdate('c'),
        ];

        if ($this->pdo) {
            $stmt = $this->pdo->prepare("
                UPDATE todos SET title=:title, notes=:notes, category=:category, priority=:priority,
                status=:status, completed=:completed, pinned=:pinned, due_date=:due_date,
                subtasks=:subtasks, updated_at=:updated_at WHERE id=:id
            ");
            $stmt->execute([
                ':id' => $id,
                ':title' => $updated['title'],
                ':notes' => $updated['notes'],
                ':category' => $updated['category'],
                ':priority' => $updated['priority'],
                ':status' => $updated['status'],
                ':completed' => $updated['completed'] ? 1 : 0,
                ':pinned' => $updated['pinned'] ? 1 : 0,
                ':due_date' => $updated['due_date'],
                ':subtasks' => json_encode($updated['subtasks']),
                ':updated_at' => $updated['updated_at'],
            ]);
        } else {
            foreach ($items as $idx => $item) {
                if ($item['id'] === $id) $items[$idx] = $updated;
            }
            $this->saveJsonAll($items);
        }
        return $this->normalizeRow($updated);
    }

    public function delete(string $id): bool
    {
        if ($this->pdo) {
            $stmt = $this->pdo->prepare("DELETE FROM todos WHERE id = :id");
            $stmt->execute([':id' => $id]);
            return $stmt->rowCount() > 0;
        }
        $items = $this->listAll();
        $filtered = array_filter($items, fn(array $i) => $i['id'] !== $id);
        if (count($filtered) === count($items)) return false;
        $this->saveJsonAll(array_values($filtered));
        return true;
    }

    public function clearCompleted(): int
    {
        if ($this->pdo) {
            $stmt = $this->pdo->prepare("DELETE FROM todos WHERE completed = 1");
            $stmt->execute();
            return $stmt->rowCount();
        }
        $items = $this->listAll();
        $remaining = array_filter($items, fn(array $i) => !$i['completed']);
        $removed = count($items) - count($remaining);
        $this->saveJsonAll(array_values($remaining));
        return $removed;
    }
}

$repo = new TodoRepository($dataDir);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';
$rawBody = file_get_contents('php://input');
$body = ($rawBody ? json_decode($rawBody, true) : null) ?: $_POST;

if ($method === 'GET' && ($action === 'list' || $action === 'status')) {
    echo json_encode(['ok' => true, 'engine' => $repo->getEngine(), 'php_version' => PHP_VERSION, 'todos' => $repo->listAll()]);
    exit;
}
if ($method === 'POST' && $action === 'create') {
    if (trim((string)($body['title'] ?? '')) === '') {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'Task title is required.']);
        exit;
    }
    http_response_code(201);
    echo json_encode(['ok' => true, 'todo' => $repo->create($body)]);
    exit;
}
if (in_array($method, ['POST', 'PUT', 'PATCH'], true) && in_array($action, ['update', 'toggle'], true)) {
    $id = (string)($body['id'] ?? $_GET['id'] ?? '');
    $updated = $repo->update($id, $body);
    echo json_encode(['ok' => (bool)$updated, 'todo' => $updated]);
    exit;
}
if (in_array($method, ['POST', 'DELETE'], true) && $action === 'delete') {
    $id = (string)($body['id'] ?? $_GET['id'] ?? '');
    echo json_encode(['ok' => $repo->delete($id), 'deleted_id' => $id]);
    exit;
}
if ($method === 'POST' && $action === 'clear_completed') {
    echo json_encode(['ok' => true, 'removed_count' => $repo->clearCompleted(), 'todos' => $repo->listAll()]);
    exit;
}
http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unsupported endpoint']);
