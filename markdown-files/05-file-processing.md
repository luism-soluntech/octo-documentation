# File Processing Workflow

## Introduction

The file processing workflow is a central component of the Octo system, responsible for downloading, decrypting, processing, and storing files from various providers. This document details the end-to-end file processing workflow and each step involved.

## Overall Workflow

```
┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│               │    │               │    │               │    │               │    │               │
│  Determine    │    │  Download     │    │  Decrypt      │    │  Process      │    │  Upload       │
│  Files to     ├───►│  Files from   ├───►│  Files        ├───►│  Files        ├───►│  to S3        │
│  Process      │    │  Provider     │    │  (if needed)  │    │  (if needed)  │    │  Storage      │
│               │    │               │    │               │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
```

The workflow begins when a job is triggered via the API, which results in a call to the `start_logic` function with a provider name. The function then orchestrates the entire file processing workflow.

## Main Logic Implementation

The main orchestration logic is implemented in the `start_logic` function:

```python
async def start_logic(queue: asyncio.Queue, provider_str: str):
  try:
    start_time = time.time()
    data = get_env_data()
    print('start logic')
    providerObject = ProviderFactory(provider_str)
    provider = providerObject.get_provider(data)
    if provider is None:
      print(f"Provider {provider_str} not found")
      await queue.put(None)
      return
    bucket_name = provider.get_bucket_name()
    print('bucket_name', bucket_name)
    saved_files = await provider.get_save_files(bucket_name)
    saved_files_arr = []
    for file in saved_files:
      file_array = file.split('/')
      saved_files_arr.append(file_array[len(file_array)-1])
    ssh_client = await provider.connect_ssh()
    pending_files = await provider.get_pending_files(saved_files_arr)
    count = 0
    total_pending = len(pending_files)
    files_with_error = []
    for file_path in pending_files:
      try:
        if file_path.endswith('.sig'):
          continue
        start_time_file = time.time()
        await provider.sftp_download(file_path)
        file_name = await provider.decrypt_file(file_path)
        file_decrypted = file_name
        file_name = await provider.unzip_file(file_name)
        await provider.upload_file(file_name)
        delete_file(file_decrypted)
        delete_file(file_path)
        end_time_file = time.time()
        elapsed_time_file = end_time_file - start_time_file
        delete_file('output/'+file_name)
        count += 1
        percentage = (count/total_pending) * 100
        await queue.put(float("{:.2f}".format(percentage)))
        print(f"{bcolors.OKGREEN}processed file (#{count}) {file_name} in {"{:10.2f}".format(elapsed_time_file)} seconds {bcolors.ENDC}")
        print(f"{bcolors.UNDERLINE}--------------------------------------------{bcolors.ENDC}")
      except Exception as e:
        count += 1
        delete_file(file_path)
        percentage = (count/total_pending) * 100
        await queue.put(float("{:.2f}".format(percentage)))
        files_with_error.append(file_path)
        print(f"an error occurred while processing file {file_path}: {e}")
        print(f"{bcolors.UNDERLINE}--------------------------------------------{bcolors.ENDC}")
        continue
    await close_connection(ssh_client)
    end_time = time.time()
    elapsed_time = end_time - start_time
    await queue.put(None)
    if files_with_error:
      print(f"{bcolors.FAIL}Files with errors: {files_with_error}{bcolors.ENDC}")
    else:
      print(f"{bcolors.OKGREEN}No files with errors{bcolors.ENDC}")
    print(f"{bcolors.WARNING}processed finished in {"{:10.2f}".format(elapsed_time)} seconds {bcolors.ENDC}")
  except Exception as e:
    print(f"an error occurred: {e}")
    await queue.put(None)
    return
```

## Detailed Steps

### 1. Determine Files to Process

The first step is to determine which files need to be processed:

```python
saved_files = await provider.get_save_files(bucket_name)
saved_files_arr = []
for file in saved_files:
  file_array = file.split('/')
  saved_files_arr.append(file_array[len(file_array)-1])
ssh_client = await provider.connect_ssh()
pending_files = await provider.get_pending_files(saved_files_arr)
```

This involves:
1. Retrieving a list of files already processed and stored in S3
2. Connecting to the provider's SFTP server
3. Comparing the files on the SFTP server with those already processed to identify new files

### 2. Download Files

For each file that needs processing, the system downloads it from the provider:

```python
await provider.sftp_download(file_path)
```

The download logic is provider-specific, but typically involves:
1. Establishing an SFTP connection using the provider's credentials
2. Retrieving the file from the provider's server
3. Storing it locally for further processing

### 3. Decrypt Files

If the files are encrypted (e.g., with GPG), they are decrypted:

```python
file_name = await provider.decrypt_file(file_path)
file_decrypted = file_name
```

The decryption process:
1. Uses the provider-specific GPG passphrase
2. Decrypts the file using the `decrypt_file` function
3. Returns the path to the decrypted file

Implementation of the `decrypt_file` function in the GPG module:

```python
async def decrypt_file(input_file_path: str, passphrase: str) -> str:
  output_file_path = remove_final_extension(input_file_path)

  gpg = gnupg.GPG()
  with open(input_file_path, 'rb') as f:
    status = gpg.decrypt_file(f, passphrase=passphrase, output=output_file_path)

  if status.ok:
    return output_file_path
  else:
    raise Exception(f"Decryption failed: {status.stderr}")
```

### 4. Process Files

Files may need additional processing, such as decompression:

```python
file_name = await provider.unzip_file(file_name)
```

The `unzip_file` method in BaseProvider:

```python
async def unzip_file(self, file_decrypted: str):
  file_name = file_decrypted
  if '.gz' in file_decrypted or '.tar.gz' in file_decrypted:
    file_name = remove_final_extension(file_name)
    file_extension = '.tar.gz' if file_name.endswith('.tar.gz') else '.gz'
    await unzip_file(file_decrypted, file_name, file_extension)
  move_file(file_name, 'output/'+file_name)
  return file_name
```

This step:
1. Identifies the compression format (if any)
2. Decompresses the file using the appropriate method
3. Moves the processed file to an output directory

### 5. Upload to S3

The processed file is uploaded to AWS S3 for storage:

```python
await provider.upload_file(file_name)
```

This step:
1. Determines the appropriate S3 bucket and folder structure
2. Uploads the file to S3
3. Organizes files in S3 based on their type and provider

The `upload_file_raw` method in BaseProvider:

```python
async def upload_file_raw(self, file_name: str, bucket_name: str):
  sub_folder = "other"
  if ".csv" in file_name:
    sub_folder = "csv"
  elif ".pdf" in file_name:
    sub_folder = "pdf"
  elif ".xml" in file_name:
    sub_folder = "xml"
  sub_folder = sub_folder + '/' + get_folder_name(file_name, provider=self.provider_name)
  await s3_upload_file('output/'+file_name, bucket_name, 'data/'+sub_folder+'/'+file_name)
```

### 6. Cleanup

After successful processing, temporary files are cleaned up:

```python
delete_file(file_decrypted)
delete_file(file_path)
delete_file('output/'+file_name)
```

Finally, the SSH connection is closed:

```python
await close_connection(ssh_client)
```

## Progress Reporting

Throughout the file processing workflow, progress is reported via the asyncio queue:

```python
percentage = (count/total_pending) * 100
await queue.put(float("{:.2f}".format(percentage)))
```

This allows the API to track and report job progress to clients.

## Error Handling

The workflow includes comprehensive error handling:

1. **File-Level Error Handling**:
   ```python
   try:
     # Process file
   except Exception as e:
     count += 1
     delete_file(file_path)
     percentage = (count/total_pending) * 100
     await queue.put(float("{:.2f}".format(percentage)))
     files_with_error.append(file_path)
     print(f"an error occurred while processing file {file_path}: {e}")
     continue
   ```

2. **Workflow-Level Error Handling**:
   ```python
   try:
     # Main workflow logic
   except Exception as e:
     print(f"an error occurred: {e}")
     await queue.put(None)
     return
   ```

This ensures that:
1. Errors processing individual files don't stop the entire job
2. Resources are properly cleaned up in case of errors
3. Error information is logged for troubleshooting
4. The API is notified of job completion even in error cases

## Performance Considerations

The file processing workflow is designed with several performance considerations:

1. **Asynchronous Processing**:
   - Uses asyncio for non-blocking I/O operations
   - Allows multiple files to be processed efficiently

2. **Resource Management**:
   - Files are deleted after processing to free up disk space
   - SSH connections are properly closed after use

3. **Progress Tracking**:
   - Regular progress updates allow for monitoring of long-running jobs
   - Elapsed time tracking helps identify bottlenecks

4. **Error Resilience**:
   - Failed files don't stop the entire job
   - Files with errors are tracked separately for later investigation

## Extension Points

The file processing workflow can be extended in several ways:

1. **New File Formats**:
   - Implement new decryption or decompression methods
   - Add handling for different file extensions

2. **Additional Processing Steps**:
   - Add data validation or transformation steps
   - Implement additional file processing logic

3. **Enhanced Reporting**:
   - Add more detailed progress reporting
   - Implement file-specific metrics

## Conclusion

The file processing workflow is a central component of the Octo system, providing a robust, extensible mechanism for handling files from different providers. By combining provider-specific logic with common file processing steps, the system achieves both flexibility and code reuse.

Developers working on the system should understand this workflow to effectively maintain and extend the file processing capabilities.
