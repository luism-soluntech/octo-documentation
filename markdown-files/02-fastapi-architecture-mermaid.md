# FastAPI Server Architecture

## Introduction

The FastAPI server is the central component of the Octo system, providing a modern, high-performance API for triggering and managing data processing jobs. This document details the architecture and implementation of the FastAPI server.

## Server Structure

```mermaid
flowchart TD
    subgraph FastAPI["FastAPI Application"]
        API["API Endpoints"] <--> Background["Background Task System"]
        API --> Auth["Authentication"]
        Background --> JobMgmt["Job Management"]
        JobMgmt --> Logic["Main Logic Processing"]
    end
```

The FastAPI application is organized into several interconnected components:

1. **API Endpoints**: RESTful endpoints for client interactions
2. **Background Task System**: Manages asynchronous job execution
3. **Authentication**: Handles API key verification and access control
4. **Job Management**: Tracks and controls job execution state
5. **Main Logic Processing**: Implements the core business logic

## Endpoint Structure

```mermaid
classDiagram
    class BaseRouter {
        +prefix: str
        +router: APIRouter
        +register_routes()
    }

    class ProviderRouter {
        +get_providers()
        +get_provider(provider_id)
        +create_job(provider_id)
    }

    class JobRouter {
        +get_jobs()
        +get_job(job_id)
        +cancel_job(job_id)
    }

    class AuthRouter {
        +login()
        +verify_token()
    }

    BaseRouter <|-- ProviderRouter
    BaseRouter <|-- JobRouter
    BaseRouter <|-- AuthRouter
```

The API endpoints are organized into router classes that inherit from a common base router:

1. **ProviderRouter**: Handles provider-related operations
2. **JobRouter**: Manages job operations (listing, retrieval, cancellation)
3. **AuthRouter**: Handles authentication operations

## Background Tasks

```mermaid
flowchart LR
    API["API Request"] --> TaskQueue["Task Queue"]
    TaskQueue --> Worker1["Worker 1"]
    TaskQueue --> Worker2["Worker 2"]
    TaskQueue --> WorkerN["Worker N"]
    Worker1 --> DB[(Database)]
    Worker2 --> DB
    WorkerN --> DB
```

The background task system uses asyncio to manage concurrent job execution:

1. API requests trigger the creation of background tasks
2. Tasks are queued and executed by worker processes
3. Workers update the database with status information
4. The system is designed to be scalable with multiple workers

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as API Endpoint
    participant Auth as Auth Service
    participant DB as Database

    Client->>API: Request with API Key
    API->>Auth: Validate API Key
    Auth->>DB: Check API Key in Database
    DB-->>Auth: API Key Valid/Invalid
    Auth-->>API: Authentication Result
    API-->>Client: Response (or 401 Unauthorized)
```

The authentication system uses API keys for secure access:

1. Clients send an API key with each request
2. The API endpoint forwards the key to the authentication service
3. The service checks the key against the database
4. If valid, the request proceeds; otherwise, an unauthorized response is returned

## Data Models

The system uses Pydantic models for data validation and SQLAlchemy models for database interactions.

## Exception Handling

The server implements a global exception handler that catches all exceptions and returns appropriate HTTP responses.

## Configuration

The server uses environment variables and configuration files to define runtime behavior.
