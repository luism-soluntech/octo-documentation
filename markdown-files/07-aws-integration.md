# AWS Integration

## Introduction

The Octo system integrates with various AWS services to facilitate secure storage and deployment of the application. This document details how the system interacts with AWS, focusing primarily on S3 storage for processed files and EC2 for deployment.

## S3 Storage Integration

### Overview

Amazon S3 (Simple Storage Service) is used as the primary storage solution for files processed by the Octo system. Files downloaded from various providers are processed and then uploaded to S3 for long-term storage and further analysis.

```
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│                │      │                │      │                │
│  Provider      │ ───► │  Octo System   │ ───► │  AWS S3        │
│  Files         │      │  Processing    │      │  Storage       │
│                │      │                │      │                │
└────────────────┘      └────────────────┘      └────────────────┘
```

### S3 Client Configuration

The system interacts with S3 using the AWS SDK for Python (Boto3):

```python
# src/config/s3/main.py
import boto3
import asyncio
from asgiref.sync import sync_to_async

@sync_to_async
def s3_read_bucket(bucket_name: str):
    s3_client = boto3.client('s3')
    objects = s3_client.list_objects_v2(Bucket=bucket_name, Prefix='data/')
    files = []
    if 'Contents' in objects:
        for obj in objects['Contents']:
            files.append(obj['Key'])
    return files

@sync_to_async
def s3_upload_file(file_path: str, bucket: str, object_name: str):
    s3_client = boto3.client('s3')
    try:
        s3_client.upload_file(file_path, bucket, object_name)
        return True
    except Exception as e:
        print(f"Error uploading to S3: {e}")
        return False
```

### Bucket Organization

Files in S3 are organized by file type and provider in a structured hierarchy:

```
bucket_name/
├── data/
│   ├── csv/
│   │   ├── affirm/
│   │   │   ├── file1.csv
│   │   │   └── file2.csv
│   │   └── bloomberg/
│   │       ├── file3.csv
│   │       └── file4.csv
│   ├── pdf/
│   │   └── ...
│   ├── xml/
│   │   └── ...
│   └── other/
│       └── ...
```

This organization is implemented in the `upload_file_raw` method:

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

The `get_folder_name` function determines the appropriate provider subfolder based on the file name and provider.

### File Tracking

The system tracks which files have already been processed by querying S3:

```python
saved_files = await provider.get_save_files(bucket_name)
saved_files_arr = []
for file in saved_files:
  file_array = file.split('/')
  saved_files_arr.append(file_array[len(file_array)-1])
```

This prevents duplicate processing of files that have already been uploaded to S3.

## EC2 Deployment

### Deployment Architecture

The Octo system is designed to be deployed on an AWS EC2 instance, as outlined in the SETUP.MD file:

```
┌────────────────────────────────────────────────────┐
│                     EC2 Instance                    │
│                                                     │
│   ┌────────────────┐         ┌────────────────┐    │
│   │                │         │                │    │
│   │  Docker        │         │  SSH/SFTP      │    │
│   │  Container     │◄────────┤  Access        │    │
│   │  (Octo System) │         │                │    │
│   │                │         │                │    │
│   └────────────────┘         └────────────────┘    │
│            │                                        │
│            │                                        │
│            ▼                                        │
│   ┌────────────────┐                               │
│   │                │                               │
│   │  AWS SDK       │                               │
│   │  (S3 Access)   │                               │
│   │                │                               │
│   └────────────────┘                               │
│                                                     │
└────────────────────────────────────────────────────┘
```

### Instance Setup

The SETUP.MD file provides detailed instructions for setting up an EC2 instance:

1. **Instance Selection**:
   - Ubuntu 24.04 AMI
   - Appropriate instance type based on workload (t3.medium, t3a.xlarge, etc.)
   - Security groups configured for necessary access

2. **Docker Installation**:
   ```bash
   sudo apt-get install -y ca-certificates curl gnupg
   sudo mkdir -p /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   # Additional docker installation steps...
   ```

3. **Code Deployment**:
   ```bash
   git clone https://github.com/<your-username>/<your-repo>.git
   cd <your-repo>
   git config credential.helper store
   git pull
   ```

### AWS Credentials Configuration

AWS credentials are configured in the EC2 instance to enable access to S3:

```
~/.aws/credentials
```

Or as environment variables:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

These credentials should be created with the principle of least privilege, with access limited to the necessary S3 buckets.

## IAM Roles and Permissions

### Required Permissions

The AWS credentials used by the system require the following permissions:

1. **S3 Permissions**:
   - `s3:ListBucket`: To list objects in the bucket
   - `s3:GetObject`: To download objects from the bucket
   - `s3:PutObject`: To upload objects to the bucket

2. **EC2 Permissions** (if using EC2 instance profile):
   - Permissions to access the required S3 buckets

### IAM Policy Example

A sample IAM policy for the Octo system:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${bucket-name}"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::${bucket-name}/data/*"
      ]
    }
  ]
}
```

## S3 Bucket Configuration

### Bucket Creation

S3 buckets should be created with appropriate settings:

1. **Region**: Select a region close to the EC2 instance for optimal performance
2. **Access Control**: Enable appropriate access controls
3. **Versioning**: Consider enabling versioning for data integrity
4. **Encryption**: Enable server-side encryption
5. **Lifecycle Rules**: Configure lifecycle rules for cost optimization

### Security Best Practices

Follow these best practices for S3 security:

1. **Block Public Access**: Ensure all public access is blocked
2. **Encryption**: Use server-side encryption for all objects
3. **Access Logging**: Enable access logging to track bucket access
4. **Bucket Policies**: Implement restrictive bucket policies
5. **IAM Policies**: Use principle of least privilege for IAM roles

## Troubleshooting AWS Integration

### Common S3 Issues

1. **Authentication Errors**:
   - Check that AWS credentials are correctly configured
   - Verify that the IAM role has appropriate permissions

2. **Upload Failures**:
   - Ensure the bucket exists and is accessible
   - Check that the file exists locally before upload
   - Verify that the IAM role has s3:PutObject permission

3. **Bucket Listing Errors**:
   - Verify that the IAM role has s3:ListBucket permission
   - Check that the bucket name is correct

### Logging and Debugging

The system includes error handling for AWS operations:

```python
try:
  s3_client.upload_file(file_path, bucket, object_name)
  return True
except Exception as e:
  print(f"Error uploading to S3: {e}")
  return False
```

Enhanced logging can be implemented for better troubleshooting:

```python
import logging

logger = logging.getLogger(__name__)

try:
  logger.info(f"Uploading {file_path} to {bucket}/{object_name}")
  s3_client.upload_file(file_path, bucket, object_name)
  logger.info(f"Successfully uploaded {file_path}")
  return True
except Exception as e:
  logger.error(f"Error uploading to S3: {e}", exc_info=True)
  return False
```

## Future AWS Integration Enhancements

Consider these enhancements to improve the AWS integration:

1. **CloudWatch Integration**:
   - Send logs to CloudWatch for centralized logging
   - Create CloudWatch alarms for error monitoring

2. **SQS Integration**:
   - Use SQS for job queuing and distribution
   - Implement a more robust job system with retries

3. **Lambda Integration**:
   - Trigger processing based on S3 events
   - Implement serverless components for certain tasks

4. **RDS Integration**:
   - Store job history and metadata in RDS
   - Implement more robust job tracking

## Conclusion

The AWS integration in the Octo system primarily focuses on S3 for file storage and EC2 for deployment. The system uses the AWS SDK for Python (Boto3) to interact with S3, implementing a structured approach to file organization and tracking.

Developers working with the system should understand the AWS integration to effectively maintain and extend the system's capabilities while following AWS best practices for security and performance.
