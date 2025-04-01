# Error Handling

## Introduction

Robust error handling is essential for ensuring the reliability and stability of the Octo system. This document outlines the error handling strategies implemented throughout the system, from API request validation to file processing errors.

## Error Handling Strategies

The Octo system implements multiple levels of error handling to ensure:

1. **Graceful Failure**: The system fails gracefully when errors occur, preventing cascading failures
2. **Detailed Logging**: Errors are logged with sufficient detail for troubleshooting
3. **Resource Cleanup**: Resources are properly cleaned up in error scenarios
4. **Progress Tracking**: Job progress is accurately reported, even when errors occur

## API-Level Error Handling

### Authentication Errors

The API uses FastAPI's dependency injection to handle authentication errors:

```python
def api_key_auth(api_key: str = Depends(oauth2_scheme)):
    if api_key not in api_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forbidden"
        )
```

When authentication fails, the API returns a standardized 401 Unauthorized response.

### Request Validation

FastAPI automatically validates request bodies using Pydantic models:

```python
class RootBody(BaseModel):
  provider: str = 'affirm'
```

Invalid requests result in detailed validation error responses:

```json
{
  "detail": [
    {
      "loc": ["body", "provider"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### Duplicate Job Prevention

The API prevents duplicate jobs for the same provider:

```python
existing_jobs = [job for job in jobs.values() if job.provider == body.provider]
if existing_jobs:
    return {"message": "A job with the same provider is already in progress"}
```

This prevents race conditions and resource conflicts.

## Background Task Error Handling

The background task system includes error handling to prevent unhandled exceptions from crashing the server:

```python
async def start_new_task(uid: UUID, param: int, provider: str) -> None:
    try:
        queue = asyncio.Queue()
        task = asyncio.create_task(start_logic(queue, provider))
        while progress := await queue.get():  # monitor task progress
            jobs[uid].progress = progress

        jobs[uid].status = "complete"
        await asyncio.sleep(1)
        jobs.pop(uid)
    except Exception as e:
        print(f"Background task error: {e}")
        jobs[uid].status = "error"
        jobs[uid].result = str(e)
```

This ensures that:
1. Exceptions in background tasks are caught and logged
2. The job status is updated to reflect the error
3. The error message is captured for later reference

## Main Logic Error Handling

The main logic function includes comprehensive error handling:

```python
async def start_logic(queue: asyncio.Queue, provider_str: str):
  try:
    # Main logic implementation

    # ...

  except Exception as e:
    print(f"an error occurred: {e}")
    await queue.put(None)
    return
```

This top-level try/except block ensures that any unhandled exceptions in the main logic are caught, logged, and reported back to the background task via the queue.

## File Processing Error Handling

The file processing loop includes error handling for individual files:

```python
for file_path in pending_files:
  try:
    if file_path.endswith('.sig'):
      continue
    # File processing steps
    # ...
  except Exception as e:
    count += 1
    delete_file(file_path)
    percentage = (count/total_pending) * 100
    await queue.put(float("{:.2f}".format(percentage)))
    files_with_error.append(file_path)
    print(f"an error occurred while processing file {file_path}: {e}")
    print(f"{bcolors.UNDERLINE}--------------------------------------------{bcolors.ENDC}")
    continue
```

This approach:
1. Catches and logs errors for individual files
2. Continues processing other files despite errors
3. Maintains accurate progress reporting
4. Tracks files with errors for later reporting

## Provider-Specific Error Handling

Provider implementations include error handling for their specific operations:

```python
async def sftp_download(self, file_path: str):
  try:
    sftp_client = paramiko.SFTPClient.from_transport(self.ssh_client.get_transport())
    print(f"Downloading {file_path}")
    sftp_client.get(f"inbox/{file_path}", file_path)
    sftp_client.close()
  except Exception as e:
    print(f"Error downloading file {file_path}: {e}")
    raise  # Re-raise to be caught by the main processing loop
```

This allows for:
1. Provider-specific error logging
2. Proper resource cleanup
3. Error propagation to the main processing loop

## Resource Cleanup in Error Scenarios

The system ensures proper resource cleanup even in error scenarios:

```python
try:
  # Operation that could fail
finally:
  # Cleanup code that always runs
  delete_file(file_path)
  sftp_client.close()
```

Key resources that are cleaned up include:
1. Temporary files
2. Network connections (SSH/SFTP)
3. File handles

## Error Reporting and Visualization

Errors are reported in several ways:

1. **Console Logging**:
   ```python
   print(f"{bcolors.FAIL}Files with errors: {files_with_error}{bcolors.ENDC}")
   ```

2. **Job Status Updates**:
   ```python
   jobs[uid].status = "error"
   jobs[uid].result = str(e)
   ```

3. **API Responses**:
   ```python
   {
     "uid": "123e4567-e89b-12d3-a456-426614174000",
     "status": "error",
     "progress": 75,
     "result": "Error downloading file file.txt: Connection refused",
     "provider": "affirm"
   }
   ```

## Error Types and Handling Strategies

### Network Errors

Network errors (connection failures, timeouts) are handled by:
1. Retrying operations (not currently implemented, but a recommended enhancement)
2. Logging detailed error information
3. Continuing with other files when possible

### File Format Errors

Errors in file formats (encryption, compression) are handled by:
1. Validating file extensions before processing
2. Providing detailed error messages for troubleshooting
3. Skipping problematic files and continuing with others

### Authentication Errors

Authentication errors (invalid credentials, expired keys) are handled by:
1. Immediate failure with clear error messages
2. Secure logging that doesn't expose sensitive information

### AWS S3 Errors

S3 interaction errors are handled by:
1. Exception handling around all S3 operations
2. Detailed error logging
3. Preventing partial uploads through proper error handling

## Logging Best Practices

The system implements several logging best practices:

1. **Error Context**: Logging includes the context of the error:
   ```python
   print(f"an error occurred while processing file {file_path}: {e}")
   ```

2. **Visual Differentiation**: Using color coding for different types of messages:
   ```python
   print(f"{bcolors.FAIL}Files with errors: {files_with_error}{bcolors.ENDC}")
   print(f"{bcolors.OKGREEN}No files with errors{bcolors.ENDC}")
   ```

3. **Performance Metrics**: Logging includes timing information:
   ```python
   print(f"{bcolors.WARNING}processed finished in {"{:10.2f}".format(elapsed_time)} seconds {bcolors.ENDC}")
   ```

## Recommended Error Handling Enhancements

The current error handling system could be enhanced in several ways:

1. **Structured Logging**:
   - Implement a proper logging framework (e.g., Python's logging module)
   - Use structured logging formats (JSON) for better analysis

2. **Retry Mechanism**:
   - Implement automatic retries for transient errors
   - Use exponential backoff for network operations

3. **Error Aggregation**:
   - Implement a system to aggregate similar errors
   - Provide summary reports of error patterns

4. **Detailed Job Error States**:
   - Expand job status beyond "in_progress", "complete", and "error"
   - Track specific error states (e.g., "authentication_error", "network_error")

5. **Error Notifications**:
   - Implement alerts for critical errors
   - Add email or webhook notifications for operational issues

## Conclusion

The Octo system implements a robust error handling strategy that ensures reliability and stability. By catching and handling errors at multiple levels, properly cleaning up resources, and providing detailed error information, the system maintains operational integrity even when issues occur.

Developers working on the system should follow the established error handling patterns, ensuring that new code maintains the same level of robustness and detailed error reporting.
