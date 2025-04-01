# Provider System

## Introduction

The Provider System is a core component of the Octo application, responsible for handling the interaction with different data providers such as Affirm and Bloomberg. This document details the architecture of the Provider System, how it works, and how to extend it with new providers.

## System Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                          Provider System                          │
│                                                                   │
│   ┌───────────────────┐        ┌───────────────────────────────┐  │
│   │                   │        │                               │  │
│   │  ProviderFactory  │───────►│          BaseProvider         │  │
│   │                   │ creates│   (Abstract Provider Class)    │  │
│   └───────────────────┘        └─────────────────┬─────────────┘  │
│                                                  │                │
│                                                  │ extends        │
│                                                  │                │
│                      ┌─────────────────────────────────────────┐  │
│                      │                                         │  │
│                      │                                         │  │
│   ┌─────────────────▼─────┐             ┌─────────────────────▼─┐ │
│   │                       │             │                       │ │
│   │    AffirmProvider     │             │   BloombergProvider   │ │
│   │                       │             │                       │ │
│   └───────────────────────┘             └───────────────────────┘ │
│                                                                   │
│                         Concrete Providers                        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Component Details

### Provider Factory

The `ProviderFactory` class is responsible for creating the appropriate provider instance based on the provider name:

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

**Key Features:**
- Lazy loading of provider modules (only imports what's needed)
- Single responsibility of creating provider instances
- Extensible design for adding new providers

### Base Provider

The `BaseProvider` class is an abstract base class that defines the interface for all provider implementations:

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

  async def sftp_download(self, file_path: str):
    pass

  def sft_list_inbox(self):
    pass

  async def get_pending_files(self, saved_files_arr:list[str]):
    pass

  def get_sub_folder(self, file_name: str):
    pass

  def upload_file(self, file_name: str):
    pass

  def decrypt_file():
    pass

  # Other methods...
```

**Key Features:**
- Defines the contract that all providers must implement
- Provides common utility methods for file handling
- Manages shared resources like SSH connections

### Concrete Providers

Concrete provider classes implement the specific logic for interacting with each provider:

**AffirmProvider Example:**
```python
class AffirmProvider(BaseProvider):
  def __init__(self, data):
    super().__init__(data, 'affirm')

  def get_bucket_name(self):
    return self.data.get('S3_BUCKET_AFFIRM')

  # Other provider-specific implementations...
```

**Key Features:**
- Provider-specific configuration (bucket names, connection details)
- Custom file handling logic if needed
- Proper implementation of all required interface methods

## Provider Workflow

Each provider follows the same general workflow, with provider-specific implementations for each step:

```
┌──────────────┐
│              │
│ Connect to   │
│ Provider     │
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│              │
│ List Files   │
│ to Process   │
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│              │
│ Download     │
│ Files        │
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│              │
│ Decrypt      │
│ Files        │
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│              │
│ Process      │
│ Files        │
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│              │
│ Upload to S3 │
│              │
└──────────────┘
```

### Connection to Provider

Each provider implements its own connection method:

```python
async def connect_ssh(self):
  hostname = self.data.get('SFTP_HOSTNAME_PROVIDER')
  username = self.data.get('SFTP_USERNAME_PROVIDER')
  port = int(self.data.get('SFTP_PORT_PROVIDER'))
  server_env = self.data.get('SERVER_ENV')
  private_key_path = self.data.get('PRIVATE_KEY_PATH_PROVIDER')
  self.ssh_client = await self.connect_ssh_raw(server_env, username, hostname, port, private_key_path)
  return self.ssh_client
```

### File Listing

Providers implement logic to list files that need to be processed:

```python
async def get_pending_files(self, saved_files_arr: list[str]):
  sftp_client = await self.sft_list_inbox()
  remote_files = sftp_client.listdir("inbox/")
  return items_not_contained_in_list(remote_files, saved_files_arr)
```

### File Download

Each provider downloads files from its source:

```python
async def sftp_download(self, file_path: str):
  sftp_client = paramiko.SFTPClient.from_transport(self.ssh_client.get_transport())
  print(f"Downloading {file_path}")
  sftp_client.get(f"inbox/{file_path}", file_path)
  sftp_client.close()
```

### File Decryption

Providers handle decryption if files are encrypted:

```python
async def decrypt_file(self, file_path: str):
  passphrase = self.data.get('GPG_PASSPHRASE_PROVIDER')
  file_name = await self.decrypt_file_raw(file_path, passphrase)
  return file_name
```

### File Upload

After processing, files are uploaded to S3:

```python
async def upload_file(self, file_name: str):
  bucket_name = self.get_bucket_name()
  await self.upload_file_raw(file_name, bucket_name)
```

## Extending the Provider System

### Adding a New Provider

To add a new provider to the system:

1. **Create a new provider class** that extends `BaseProvider`:

```python
# src/core/providers/new_provider.py
from src.core.providers.base import BaseProvider

class NewProvider(BaseProvider):
  def __init__(self, data):
    super().__init__(data, 'new_provider')

  def get_bucket_name(self):
    return self.data.get('S3_BUCKET_NEW_PROVIDER')

  # Implement all required methods...
```

2. **Update the factory** to create instances of the new provider:

```python
def get_provider(self, data) -> BaseProvider | None:
  if self.provider == "affirm":
    from src.core.providers.affirm import AffirmProvider
    return AffirmProvider(data)
  elif self.provider == "bloomberg":
    from src.core.providers.bloomberg import BloombergProvider
    return BloombergProvider(data)
  elif self.provider == "new_provider":
    from src.core.providers.new_provider import NewProvider
    return NewProvider(data)
  else:
    return None
```

3. **Add environment variables** for the new provider in `.env` or environment configuration.

4. **Test the new provider** by sending a request with the new provider name.

### Provider Requirements

When implementing a new provider, ensure it:

1. **Extends BaseProvider**: Inherits and implements all required methods
2. **Handles Authentication**: Implements correct authentication for the provider
3. **Manages Resources**: Properly acquires and releases resources (connections, files)
4. **Reports Progress**: Uses the queue to report progress during processing
5. **Handles Errors**: Includes appropriate error handling and reporting

## Configuration

Providers are configured through environment variables loaded via the `get_env_data()` function:

```python
data = get_env_data()
providerObject = ProviderFactory(provider_str)
provider = providerObject.get_provider(data)
```

Common configuration parameters include:

- **S3_BUCKET_PROVIDER**: S3 bucket name for storing files
- **SFTP_HOSTNAME_PROVIDER**: SFTP server hostname
- **SFTP_USERNAME_PROVIDER**: SFTP username
- **SFTP_PORT_PROVIDER**: SFTP port number
- **SERVER_ENV**: Environment (dev/prod)
- **PRIVATE_KEY_PATH_PROVIDER**: Path to SSH private key
- **GPG_PASSPHRASE_PROVIDER**: Passphrase for GPG decryption

## Error Handling

Providers should implement robust error handling:

```python
try:
  # Provider operation
except Exception as e:
  print(f"an error occurred while processing file {file_path}: {e}")
  # Clean up resources, report error, continue if possible
```

The main logic also includes error handling to prevent provider errors from crashing the entire process.

## Best Practices

When working with the Provider System:

1. **Follow the Interface**: Implement all methods defined in `BaseProvider`
2. **Resource Management**: Always close connections and clean up files
3. **Error Handling**: Handle and report errors gracefully
4. **Progress Reporting**: Update the progress queue regularly
5. **Idempotent Operations**: Ensure operations can be safely retried
6. **Minimal Dependencies**: Keep provider implementations focused on their specific tasks

## Testing

Providers should be tested to ensure they:

1. Connect to their data sources correctly
2. List and filter files properly
3. Download, decrypt, and process files as expected
4. Upload files to S3 with the correct structure
5. Handle errors gracefully

Use mocking to test providers without actual external connections during development.
