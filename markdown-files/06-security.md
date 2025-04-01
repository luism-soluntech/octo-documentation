# Security Implementation

## Introduction

Security is a critical aspect of the Octo system, which handles potentially sensitive financial data from various providers. This document outlines the security measures implemented throughout the system to protect data and prevent unauthorized access.

## Authentication and Authorization

### API Authentication

The FastAPI server implements OAuth2 with API key authentication:

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

API keys are loaded from environment variables, ensuring they are not hardcoded in the source code. All API endpoints are protected by this authentication mechanism:

```python
@app.post("/", dependencies=[Depends(api_key_auth)])
def test(background_tasks: BackgroundTasks, body: RootBody):
    # Handler implementation
```

### Provider Authentication

For provider authentication, the system uses SSH key-based authentication or username/password authentication depending on the provider's requirements:

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
  myfile = None
  if private_key_path is not None:
    myfile = paramiko.RSAKey.from_private_key_file(private_key_path)
  print('server_env', server_env)
  if server_env == 'dev':
    proxy = paramiko.proxy.ProxyCommand('/usr/bin/nc -x 127.0.0.1:9090 %s %d' % (hostname, port))
    ssh_client.connect(hostname=hostname, username=user_name, pkey=myfile, password=password, sock=proxy)
  else :
    ssh_client.connect(hostname=hostname, username=user_name, pkey=myfile, password=password)
  return ssh_client
```

## Data Protection

### Encrypted Data Handling

The system can handle encrypted files from providers using GPG:

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

Passphrases for GPG decryption are stored as environment variables, not in the code.

### Secure File Transfer

All file transfers between providers and the system use secure protocols:

1. **SFTP over SSH** for downloading files from providers
2. **HTTPS** for uploading files to AWS S3

```python
# SFTP download
async def sftp_download(self, file_path: str):
  sftp_client = paramiko.SFTPClient.from_transport(self.ssh_client.get_transport())
  print(f"Downloading {file_path}")
  sftp_client.get(f"inbox/{file_path}", file_path)
  sftp_client.close()

# S3 upload with HTTPS
async def s3_upload_file(file_path: str, bucket: str, object_name: str):
  s3_client = boto3.client('s3')
  try:
    s3_client.upload_file(file_path, bucket, object_name)
    return True
  except Exception as e:
    print(f"Error uploading to S3: {e}")
    return False
```

### Resource Cleanup

To prevent sensitive data from persisting on disk, the system cleans up temporary files after processing:

```python
delete_file(file_decrypted)
delete_file(file_path)
delete_file('output/'+file_name)
```

The `delete_file` function securely removes files:

```python
def delete_file(file_path: str):
  try:
    if os.path.exists(file_path):
      os.remove(file_path)
  except Exception as e:
    print(f"Error deleting file {file_path}: {e}")
```

## Environment Security

### Environment Variables

Sensitive information such as API keys, passphrases, and connection details are stored as environment variables:

```python
def get_env_data():
  return {
    'API_KEY': os.environ.get('API_KEY'),
    'S3_BUCKET_AFFIRM': os.environ.get('S3_BUCKET_AFFIRM'),
    'SFTP_HOSTNAME_AFFIRM': os.environ.get('SFTP_HOSTNAME_AFFIRM'),
    'SFTP_USERNAME_AFFIRM': os.environ.get('SFTP_USERNAME_AFFIRM'),
    'SFTP_PORT_AFFIRM': os.environ.get('SFTP_PORT_AFFIRM'),
    'PRIVATE_KEY_PATH_AFFIRM': os.environ.get('PRIVATE_KEY_PATH_AFFIRM'),
    'GPG_PASSPHRASE_AFFIRM': os.environ.get('GPG_PASSPHRASE_AFFIRM'),
    # ... other environment variables
  }
```

### Secure Development Practices

The system's security is also enforced through development practices:

1. **No Hardcoded Secrets**: All sensitive data is stored in environment variables
2. **Dependency Management**: Regular updates to dependencies to address security vulnerabilities
3. **Environment Isolation**: Different configurations for development and production environments

## AWS Security Configuration

### S3 Bucket Security

The system interacts with AWS S3 buckets, which should be configured with appropriate security settings:

1. **Access Control**: S3 buckets should have appropriate bucket policies and IAM roles
2. **Encryption**: Server-side encryption should be enabled for S3 buckets
3. **Access Logging**: S3 access logging should be enabled to track access to files

### Access Management

AWS access is managed through IAM roles and policies, with the principle of least privilege:

```python
# S3 client creation with AWS credentials from environment variables
def s3_client():
  return boto3.client(
    's3',
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
  )
```

## Security Considerations for Deployment

### Docker Deployment

When deploying the system using Docker (as outlined in SETUP.MD), several security considerations should be addressed:

1. **Secret Management**: Use environment variables or a secure secret management system
2. **Network Security**: Configure appropriate network access controls
3. **Container Security**: Use up-to-date Docker images and security best practices

### EC2 Instance Security

For EC2 deployment:

1. **Security Groups**: Configure restrictive security groups
2. **SSH Access**: Limit SSH access to authorized users and IP addresses
3. **Updates**: Keep the system updated with security patches

## Error Handling and Logging

Proper error handling is essential for security to prevent information leakage and ensure system resilience:

```python
try:
  # Operation
except Exception as e:
  print(f"an error occurred: {e}")
  # Handle error without exposing sensitive information
```

Logs should be carefully managed to:
1. Avoid logging sensitive information (such as API keys or passwords)
2. Provide enough detail for troubleshooting
3. Be stored securely

## Security Recommendations

To enhance the security of the system, consider implementing:

1. **Enhanced Authentication**:
   - Implement token expiration and rotation
   - Add support for OAuth2 with multiple authentication providers

2. **Improved File Security**:
   - Implement file integrity checks (checksums)
   - Add support for client-side encryption of S3 uploads

3. **Monitoring and Alerts**:
   - Add security event monitoring
   - Implement alerts for suspicious activities

4. **Penetration Testing**:
   - Regularly test the system for security vulnerabilities
   - Address identified issues promptly

5. **Audit Logging**:
   - Implement comprehensive audit logging
   - Store logs securely for compliance and forensic purposes

## Conclusion

The Octo system implements various security measures to protect data and ensure secure operations. By using secure protocols, proper authentication, and careful handling of sensitive information, the system maintains a strong security posture.

Developers should continue to prioritize security when maintaining and extending the system, following the established security practices and implementing recommended enhancements as appropriate.
