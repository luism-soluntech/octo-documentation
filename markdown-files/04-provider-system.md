# Provider System

## Introduction

The Provider System is a core component of the Octo application, responsible for handling the interaction with different data providers such as Affirm and Bloomberg. This document details the architecture of the Provider System, how it works, and how to extend it with new providers.

## System Architecture

```mermaid
classDiagram
    direction TB

    class ProviderFactory {
        +get_provider(data) BaseProvider
    }

    class BaseProvider {
        <<abstract>>
        +connect()
        +fetch_files()
        +process_files()
        +upload_files()
    }

    class AffirmProvider {
        +connect()
        +fetch_files()
        +process_files()
        +upload_files()
    }

    class BloombergProvider {
        +connect()
        +fetch_files()
        +process_files()
        +upload_files()
    }

    ProviderFactory ..> BaseProvider : creates
    BaseProvider <|-- AffirmProvider : extends
    BaseProvider <|-- BloombergProvider : extends

    note for ProviderFactory "Creates appropriate provider\nbased on input parameters"
    note for BaseProvider "Defines interface for\nall providers"
```

The Provider System consists of several key components:

1. **ProviderFactory**: Creates instances of specific providers based on input parameters
2. **BaseProvider**: An abstract class defining the interface for all providers
3. **Concrete Providers**: Implementations for specific data sources (Affirm, Bloomberg)

## Provider Workflow

```mermaid
sequenceDiagram
    participant Client
    participant Factory as ProviderFactory
    participant Provider as Concrete Provider
    participant ExternalAPI as External API
    participant S3 as AWS S3

    Client->>Factory: get_provider(provider_name, data)
    Factory->>Provider: create provider instance
    Factory-->>Client: return provider instance
    Client->>Provider: process_files()
    Provider->>ExternalAPI: connect()
    ExternalAPI-->>Provider: connection established
    Provider->>ExternalAPI: fetch_files()
    ExternalAPI-->>Provider: raw files
    Provider->>Provider: decrypt_files()
    Provider->>Provider: transform_files()
    Provider->>S3: upload_files()
    S3-->>Provider: upload confirmation
    Provider-->>Client: processing result
```

The typical workflow for a provider includes:

1. Client requests a provider instance from the factory
2. Factory creates the appropriate provider based on the provider name
3. Client calls processing methods on the provider
4. Provider connects to the external API/SFTP/etc.
5. Provider fetches, processes, and uploads files
6. Results are returned to the client

## Provider Interface

The BaseProvider abstract class defines the following interface:

```python
class BaseProvider(ABC):
    def __init__(self, data):
        self.data = data
        self.connection = None

    @abstractmethod
    def connect(self):
        """Establish connection to the provider"""
        pass

    @abstractmethod
    def fetch_files(self):
        """Fetch files from the provider"""
        pass

    @abstractmethod
    def process_files(self):
        """Process the fetched files"""
        pass

    @abstractmethod
    def upload_files(self, destination):
        """Upload processed files"""
        pass

    def cleanup(self):
        """Clean up temporary files"""
        # Default implementation
        pass
```

## Implementing a New Provider

```mermaid
flowchart TD
    A[Create new provider class] --> B[Inherit from BaseProvider]
    B --> C[Implement all abstract methods]
    C --> D[Add provider to ProviderFactory]
    D --> E[Test new provider]
    E --> F[Document the new provider]
```

To add a new provider:

1. Create a new provider class that inherits from BaseProvider
2. Implement all required methods (connect, fetch_files, process_files, upload_files)
3. Add the new provider to the ProviderFactory class
4. Test the new provider with sample data
5. Document the specifics of the new provider

## Provider-Specific Configurations

Each provider may have specific configuration requirements:

```mermaid
classDiagram
    class BaseProviderConfig {
        +str provider_name
        +str base_url
        +dict credentials
    }

    class AffirmProviderConfig {
        +str sftp_host
        +int sftp_port
        +str sftp_username
        +str sftp_password
        +str gpg_key_path
    }

    class BloombergProviderConfig {
        +str api_key
        +str api_secret
        +str endpoint_url
        +int retry_limit
    }

    BaseProviderConfig <|-- AffirmProviderConfig
    BaseProviderConfig <|-- BloombergProviderConfig
```

Configurations are stored in environment variables or configuration files and loaded at runtime.

## Error Handling and Retries

The Provider System implements robust error handling and retry mechanisms:

```mermaid
flowchart TD
    A[Provider Method Call] --> B{Success?}
    B -->|Yes| C[Return Result]
    B -->|No| D{Retryable Error?}
    D -->|Yes| E[Retry with Backoff]
    E --> B
    D -->|No| F[Log Error and Raise Exception]
```

Errors are categorized as:
- **Retryable**: Connection issues, timeouts, temporary service failures
- **Non-retryable**: Authentication failures, invalid parameters, permission issues

## Security Considerations

Provider connections implement security best practices:

```mermaid
flowchart LR
    A[Credentials] -->|Encrypted| B[Credential Store]
    B -->|Decrypted at Runtime| C[Provider Connection]
    C -->|Secure Protocol| D[External Service]
```

Security measures include:
- Encrypted credential storage
- Secure connection protocols (SFTP, HTTPS)
- Limited access permissions
- Audit logging of all provider operations
