import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly isMinIO: boolean;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get('R2_BUCKET_NAME', 'escrowx-files');
    this.publicUrl = config.get('R2_PUBLIC_URL', '');

    const r2AccountId = config.get('R2_ACCOUNT_ID', '');
    this.isMinIO = !r2AccountId;

    if (this.isMinIO) {
      const minioEndpoint = config.get('MINIO_ENDPOINT', 'http://localhost:9000');
      this.s3 = new S3Client({
        region: 'us-east-1',
        endpoint: minioEndpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.get('MINIO_ACCESS_KEY', 'escrowx_minio'),
          secretAccessKey: config.get('MINIO_SECRET_KEY', 'escrowx_minio_secret'),
        },
      });
    } else {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.get('R2_ACCESS_KEY_ID', ''),
          secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', ''),
        },
      });
    }
  }

  async onModuleInit() {
    if (this.isMinIO) {
      await this.ensureBucketExists();
    }
  }

  private async ensureBucketExists() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        const policy = JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          }],
        });
        await this.s3.send(new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: policy }));
        this.logger.log(`Bucket "${this.bucket}" created`);
      } catch (err) {
        this.logger.error('Failed to create MinIO bucket:', err);
      }
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );

    if (this.isMinIO) {
      const endpoint = this.config.get('MINIO_ENDPOINT', 'http://localhost:9000');
      return `${endpoint}/${this.bucket}/${key}`;
    }

    return this.publicUrl ? `${this.publicUrl}/${key}` : this.getPresignedUrl(key);
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
