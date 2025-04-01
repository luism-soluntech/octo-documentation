# Design Patterns

## Introduction

The Octo FastAPI server implementation uses several design patterns to achieve a clean, maintainable architecture. This document outlines the key design patterns used in the system and explains how they contribute to the overall architecture.

## Factory Pattern

### Implementation

The Factory Pattern is used to create provider-specific handlers through the `ProviderFactory` class:

```python
class ProviderFactory():
  def __init__(self, provider):
    self.provider = provider

  def get_provider(self, data) -> BaseProvider | None:
    if self.provider == "affirm":
      from src.core.providers.affirm import AffirmProvider
      return AffirmProvider(data)
    elif self.provider == "bloomberg":
      from src.core.providers.bloomberg import BloombergProvider
      return BloombergProvider(data)
    else:
      return None
```

### Usage

The factory is used in the main logic to create the appropriate provider instance:

```python
providerObject = ProviderFactory(provider_str)
provider = providerObject.get_provider(data)
```

### Benefits

- **Encapsulation**: Hides the complexity of provider creation
- **Extensibility**: New providers can be added by extending the factory without modifying client code
- **Conditional Loading**: Only imports the necessary provider modules when needed

## Strategy Pattern

### Implementation

The Strategy Pattern is implemented through the `BaseProvider` abstract class and its concrete implementations:

```python
class BaseProvider:
  def __init__(self, data: dict[str, str | None], provider_name: str):
    self.data = data
    self.provider_name = provider_name
    self.sftp_client = None
    self.ssh_client = None

  def get_bucket_name():
    pass

  def connect_ssh():
    pass

  # other abstract methods...
```

Concrete implementations for different providers:

```python
class AffirmProvider(BaseProvider):
  def __init__(self, data):
    super().__init__(data, 'affirm')

  def get_bucket_name(self):
    return self.data.get('S3_BUCKET_AFFIRM')

  # other overridden methods...
```

### Usage

The client code (main logic) interacts with the abstract `BaseProvider` interface, unaware of the specific provider implementation:

```python
await provider.get_save_files(bucket_name)
ssh_client = await provider.connect_ssh()
pending_files = await provider.get_pending_files(saved_files_arr)
# ...
```

### Benefits

- **Interchangeability**: Different provider implementations can be used interchangeably
- **Separation of Concerns**: Each provider encapsulates its specific behavior
- **Extensibility**: New providers can be added without changing the client code

## Template Method Pattern

### Implementation

The Template Method Pattern is implemented in the `BaseProvider` class, which defines a skeleton for the file processing algorithm while allowing subclasses to override specific steps:

```python
class BaseProvider:
  # ... other methods ...

  async def decrypt_file_raw(self, file_path: str, passphrase: str):
    file_decrypted = file_path
    if '.gpg' in file_path:
      file_decrypted = await decrypt_file(file_path, passphrase)
    file_name = file_decrypted
    return file_name

  async def unzip_file(self, file_decrypted: str):
    file_name = file_decrypted
    if '.gz' in file_decrypted or '.tar.gz' in file_decrypted:
      file_name = remove_final_extension(file_name)
      file_extension = '.tar.gz' if file_name.endswith('.tar.gz') else '.gz'
      await unzip_file(file_decrypted, file_name, file_extension)
    move_file(file_name, 'output/'+file_name)
    return file_name
```

### Usage

Provider-specific classes can override parts of this process while maintaining the overall algorithm structure.

### Benefits

- **Code Reuse**: Common processing steps are defined once in the base class
- **Consistency**: Ensures a consistent approach across different providers
- **Flexibility**: Allows customization of specific steps when needed

## Dependency Injection

### Implementation

Dependency Injection is used throughout the codebase to provide configuration data, queues, and other dependencies to components:

```python
# Injecting configuration data
def __init__(self, data: dict[str, str | None], provider_name: str):
  self.data = data
  self.provider_name = provider_name

# Injecting a queue for progress updates
async def start_logic(queue: asyncio.Queue, provider_str: str):
  # ...
  await queue.put(float("{:.2f}".format(percentage)))
```

### Usage

Dependencies are passed explicitly to functions and classes rather than being created or retrieved internally.

### Benefits

- **Testability**: Components can be tested in isolation with mock dependencies
- **Flexibility**: Dependencies can be swapped without changing component code
- **Decoupling**: Reduces tight coupling between components

## Observer Pattern (via Queue)

### Implementation

The Observer Pattern is implemented through the use of an asyncio Queue to report progress from the main logic back to the background task:

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

### Usage

The main logic function acts as the subject, publishing progress updates to the queue, while the background task acts as the observer, updating the job status based on these updates.

### Benefits

- **Loose Coupling**: The main logic doesn't need to know about the job tracking system
- **Asynchronous Updates**: Progress can be reported asynchronously without blocking the main processing
- **Separation of Concerns**: Processing logic is separated from progress tracking

## Command Pattern (via Background Tasks)

### Implementation

The Command Pattern is evident in the way background tasks are created and executed:

```python
background_tasks.add_task(start_new_task, new_task.uid, 100, body.provider)
```

### Usage

The API endpoint creates a command (background task) that encapsulates the request and its parameters, which is then executed independently.

### Benefits

- **Asynchronous Execution**: Commands run without blocking the API response
- **Queueing**: FastAPI's background task system handles queuing and execution
- **Decoupling**: Command execution is decoupled from API request handling

## Proxy Pattern (SSH/SFTP)

### Implementation

The Proxy Pattern is used to provide a common interface for accessing remote files over SSH/SFTP:

```python
@sync_to_async
def connect_ssh_raw(
  self,
  server_env: str,
  user_name: str,
  hostname: str,
  port: int,
  private_key_path: str | None = None,
  password: str | None = None,
):
  ssh_client = paramiko.SSHClient()
  ssh_client.load_system_host_keys()
  # ... setup and connect ...
  return ssh_client
```

### Usage

The SFTP/SSH connection acts as a proxy for files on remote systems, providing a local interface to remote resources.

### Benefits

- **Access Control**: Centralized handling of authentication and access
- **Abstraction**: Simplifies interactions with remote file systems
- **Resource Management**: Centralizes connection management and cleanup

## Adapter Pattern

### Implementation

The Adapter Pattern is used to adapt various file formats (encrypted, compressed) to a common interface:

```python
async def decrypt_file_raw(self, file_path: str, passphrase: str):
  file_decrypted = file_path
  if '.gpg' in file_path:
    file_decrypted = await decrypt_file(file_path, passphrase)
  file_name = file_decrypted
  return file_name

async def unzip_file(self, file_decrypted: str):
  # ... handle various compression formats ...
```

### Usage

These adapter methods convert files from their original format to a format that can be processed by the system, regardless of how they were originally stored.

### Benefits

- **Format Independence**: Processing logic can work with files regardless of their original format
- **Simplification**: Complex format handling is encapsulated in adapter methods
- **Extensibility**: New file formats can be supported by adding new adapter methods

## Design Patterns Interaction

The design patterns in the system don't exist in isolation but work together to create a cohesive architecture:

```
┌──────────────────┐                ┌──────────────────┐
│                  │                │                  │
│  Factory Pattern │───creates────►│  Strategy Pattern │
│                  │                │                  │
└──────────────────┘                └──────────────────┘
                                          │
                                          │ implements
                                          ▼
┌──────────────────┐                ┌──────────────────┐
│                  │                │                  │
│  Command Pattern │◄───triggers───│ Template Method  │
│                  │                │                  │
└──────────────────┘                └──────────────────┘
        │                                   │
        │                                   │
        ▼                                   ▼
┌──────────────────┐                ┌──────────────────┐
│                  │                │                  │
│ Observer Pattern │◄───updates────│  Adapter Pattern  │
│                  │                │                  │
└──────────────────┘                └──────────────────┘
                                          │
                                          │
                                          ▼
                                   ┌──────────────────┐
                                   │                  │
                                   │   Proxy Pattern  │
                                   │                  │
                                   └──────────────────┘
```

## Conclusion

The Octo project demonstrates the effective use of multiple design patterns to create a flexible, maintainable architecture. These patterns work together to:

1. **Decouple Components**: Each component has a single responsibility and minimal knowledge of other components
2. **Facilitate Extension**: New providers and file types can be added with minimal changes to existing code
3. **Promote Reuse**: Common functionality is encapsulated and reused across the system
4. **Improve Testability**: Components can be tested in isolation with mock dependencies

By understanding these design patterns and their interactions, developers can maintain and extend the system more effectively, following the established architectural principles.
