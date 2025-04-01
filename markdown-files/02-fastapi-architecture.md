# FastAPI Server Architecture

## Introduction

The FastAPI server is the central component of the Octo system, providing a modern, high-performance API for triggering and managing data processing jobs. This document details the architecture and implementation of the FastAPI server.

## Server Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Application                     │
│                                                             │
│  ┌─────────────────┐           ┌─────────────────────────┐  │
│  │                 │           │                         │  │
│  │  API Endpoints  │◄─────────►│  Background Task System │  │
│  │                 │           │                         │  │
│  └─────────────────┘           └─────────────────────────┘  │
│           │                                │                │
│           │                                │                │
│           ▼                                ▼                │
│  ┌─────────────────┐           ┌─────────────────────────┐  │
│  │                 │           │                         │  │
│  │ Authentication  │           │      Job Management     │  │
│  │                 │           │                         │  │
│  └─────────────────┘           └─────────────────────────┘  │
│                                          │                  │
│                                          │                  │
│                                          ▼                  │
│                              ┌─────────────────────────┐    │
│                              │                         │    │
│                              │  Main Logic Processing  │    │
│                              │                         │    │
│                              └─────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. API Endpoints

The FastAPI server exposes two main endpoints:

- **POST /** - Creates a new job for a specified provider
  - Requires authentication via API key
  - Takes a `RootBody` object containing the provider name
  - Returns a job object with a unique ID and initial status

- **GET /tasks** - Lists all current jobs and their statuses
  - Requires authentication via API key
  - Returns a dictionary of all active jobs

```python
@app.post("/", dependencies=[Depends(api_key_auth)])
def test(background_tasks: BackgroundTasks, body: RootBody):
    print('body', body);
    existing_jobs = [job for job in jobs.values() if job.provider == body.provider]
    if existing_jobs:
        return {"message": "A job with the same provider is already in progress"}
    new_task = Job()
    new_task.provider = body.provider
    jobs[new_task.uid] = new_task
    background_tasks.add_task(start_new_task, new_task.uid, 100, body.provider)
    return new_task

@app.get("/tasks", dependencies=[Depends(api_key_auth)])
async def status_handler():
    return jobs
```

### 2. Authentication System

The server uses OAuth2 with API key authentication:

```python
# API key storage
api_keys = [
    data.get('API_KEY')
]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def api_key_auth(api_key: str = Depends(oauth2_scheme)):
    if api_key not in api_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forbidden"
        )
```

The API key is loaded from environment variables and validated on each request using FastAPI's dependency injection system.

### 3. Job Management System

Jobs are represented using Pydantic models and stored in memory:

```python
class Job(BaseModel):
    uid: UUID = Field(default_factory=uuid4)
    status: str = "in_progress"
    progress: int = 0
    result: int = None
    provider: str = None

jobs: Dict[UUID, Job] = {}  # Dict as job storage
```

Each job has:
- A unique identifier (`uid`)
- A status field (`in_progress` or `complete`)
- A progress percentage
- A result field (for storing any result data)
- A provider name

### 4. Background Task System

FastAPI's background tasks are used to run jobs asynchronously:

```python
async def start_new_task(uid: UUID, param: int, provider: str) -> None:
    queue = asyncio.Queue()
    task = asyncio.create_task(start_logic(queue, provider))
    while progress := await queue.get():  # monitor task progress
        jobs[uid].progress = progress

    jobs[uid].status = "complete"
    await asyncio.sleep(1)
    jobs.pop(uid)
```

The background task system:
1. Creates an asyncio queue for progress updates
2. Starts the main logic as an asyncio task
3. Continuously updates job progress from the queue
4. Marks the job as complete and removes it after completion

### 5. Main Processing Logic

The main processing logic is decoupled from the server and imported from the `src.main_logic` module:

```python
task = asyncio.create_task(start_logic(queue, provider))
```

This separation of concerns allows the main processing logic to evolve independently from the API server.

## Data Flow

```
1. Client makes API request with API key
2. Server authenticates the request
3. Server creates a new job instance
4. Server launches a background task
5. Background task runs the main processing logic
6. Main logic reports progress via queue
7. Background task updates job status
8. Client can check job status via GET /tasks endpoint
```

## Concurrency and Performance Considerations

The FastAPI server leverages Python's asyncio to handle concurrent requests efficiently. Key performance aspects include:

1. **Asynchronous Task Processing**:
   - Jobs run asynchronously as background tasks
   - The main API routes remain responsive even during long-running jobs

2. **One Job Per Provider**:
   - The system prevents multiple jobs for the same provider from running simultaneously
   - This prevents race conditions when accessing provider resources

3. **In-Memory Job Storage**:
   - Jobs are stored in memory for fast access
   - Jobs are automatically removed when completed to prevent memory leaks

4. **Progress Reporting**:
   - Uses an asyncio Queue for efficient progress updates
   - Progress is reported as a percentage, allowing clients to track job completion

## Error Handling

The server includes several error handling mechanisms:

1. **API Authentication Errors**:
   - Invalid API keys result in a 401 Unauthorized response

2. **Provider Validation**:
   - Non-existent providers are detected early in the process

3. **Job Duplication Prevention**:
   - Attempts to create duplicate jobs for the same provider are rejected

4. **Exception Handling in Tasks**:
   - The main logic includes exception handling to prevent unhandled exceptions from crashing the server

## Future Enhancements

Potential enhancements to the FastAPI server architecture:

1. **Persistent Job Storage**:
   - Implement a database backend for jobs to survive server restarts

2. **Job Cancellation**:
   - Add an endpoint to cancel running jobs

3. **Scheduled Jobs**:
   - Add support for scheduled/recurring jobs

4. **Detailed Job Logs**:
   - Enhance job objects to include detailed logs and error information
