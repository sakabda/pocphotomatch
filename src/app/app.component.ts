import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule } from 'ng-zorro-antd/icon';
import {
  Observable,
  Observer,
  Subscription,
  interval,
  forkJoin,
  of,
} from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { shipData } from './ship.data';

interface UploadStatus {
  totalFiles: number;
  processedFiles: number;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  currentBatch: number;
  totalBatches: number;
}

interface BatchResponse {
  batch_id: string;
  [key: string]: any;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NzUploadModule,
    NzButtonModule,
    NzGridModule,
    NzCardModule,
    NzMessageModule,
    NzProgressModule,
    NzSpinModule,
    NzIconModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private apiUrl = 'http://65.109.13.253:8000';
  private readonly BATCH_SIZE = 100; // Size of each upload batch
  fileList: NzUploadFile[] = [];
  uploading = false;
  batchId: string | null = null;
  uploadStatus: UploadStatus = {
    totalFiles: 0,
    processedFiles: 0,
    progress: 0,
    status: 'pending',
    currentBatch: 0,
    totalBatches: 0,
  };
  pollingSubscription?: Subscription;

  shipData = shipData.map((section) => ({
    ...section,
    matchPercentage: 0,
  }));

  constructor(private http: HttpClient, private message: NzMessageService) {}

  handleUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (!files) return;

    Array.from(files).forEach((file) => {
      const nzFile: NzUploadFile = {
        uid: `${Date.now()}-${this.fileList.length}`,
        name: file.name,
        size: file.size,
        type: file.type,
        originFileObj: file,
      };

      if (file.type?.startsWith('image/')) {
        this.fileList = [...this.fileList, nzFile];
      } else {
        this.message.error('You can only upload image files!');
      }
    });

    if (this.fileList.length > 1000) {
      this.message.warning('Maximum 1000 images can be uploaded at once');
      this.fileList = this.fileList.slice(0, 1000);
    }
  }

  private uploadBatch(
    files: NzUploadFile[],
    batchNumber: number,
    totalBatches: number
  ): Observable<any> {
    const formData = new FormData();
    files.forEach((file) => {
      if (file.originFileObj) {
        formData.append('files', file.originFileObj);
      }
    });

    const batchInfo = {
      uploadDate: new Date().toISOString(),
      totalFiles: files.length,
      name: `Ship Images Batch ${batchNumber + 1}/${totalBatches}`,
      description: `Part ${batchNumber + 1} of ${totalBatches} total batches`,
    };

    formData.append(
      'batch_info',
      new Blob([JSON.stringify(batchInfo)], { type: 'application/json' })
    );

    return this.http
      .post(`${this.apiUrl}/upload_images/`, formData, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        map((event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const batchProgress = Math.round(
              (100 * event.loaded) / event.total
            );
            const overallProgress = Math.round(
              (batchNumber * 100 + batchProgress) / totalBatches
            );
            this.uploadStatus.progress = overallProgress;
          } else if (event.type === HttpEventType.Response) {
            if (event.body) {
              const response = event.body as BatchResponse;
              if (!this.batchId && response.batch_id) {
                this.batchId = response.batch_id;
              }
              this.uploadStatus.processedFiles += files.length;
              this.uploadStatus.currentBatch = batchNumber + 1;
              return response;
            }
          }
          return null;
        }),
        catchError((error) => {
          console.error(`Batch ${batchNumber + 1} upload error:`, error);
          return of(null);
        })
      );
  }

  uploadFiles(): void {
    if (this.fileList.length === 0) {
      this.message.warning('Please select images to upload');
      return;
    }

    this.uploading = true;
    this.uploadStatus = {
      totalFiles: this.fileList.length,
      processedFiles: 0,
      progress: 0,
      status: 'uploading',
      currentBatch: 0,
      totalBatches: Math.ceil(this.fileList.length / this.BATCH_SIZE),
    };

    // Split files into batches
    const batches: NzUploadFile[][] = [];
    for (let i = 0; i < this.fileList.length; i += this.BATCH_SIZE) {
      batches.push(this.fileList.slice(i, i + this.BATCH_SIZE));
    }

    // Upload batches sequentially
    const uploadSequentially = (index: number) => {
      if (index >= batches.length) {
        this.message.success('All batches uploaded successfully');
        this.startPolling();
        return;
      }

      this.uploadBatch(batches[index], index, batches.length).subscribe({
        next: (response) => {
          if (response) {
            uploadSequentially(index + 1);
          } else {
            this.handleUploadError();
          }
        },
        error: () => this.handleUploadError(),
      });
    };

    uploadSequentially(0);
  }

  private handleUploadError(): void {
    // this.message.error('Upload failed');
    this.uploading = false;
    this.uploadStatus.status = 'error';
  }

  startPolling(): void {
    this.uploadStatus.status = 'processing';
    this.pollingSubscription = interval(5000).subscribe(() => {
      if (this.batchId) {
        this.checkProcessingStatus();
      }
    });
  }

  checkProcessingStatus(): void {
    this.http.get(`${this.apiUrl}/batch_status/${this.batchId}`).subscribe({
      next: (response: any) => {
        this.uploadStatus.processedFiles = response.processed_files;
        if (response.status === 'completed') {
          this.uploadStatus.status = 'completed';
          this.uploading = false;
          this.pollingSubscription?.unsubscribe();
          this.message.success('All images processed successfully');
        }
      },
      error: (error) => {
        console.error('Status check error:', error);
        this.message.error('Failed to check processing status');
      },
    });
  }

  matchImages(): void {
    if (!this.batchId) {
      this.message.warning('Please upload images first');
      return;
    }

    this.uploading = true;
    const totalSections = this.shipData.length;
    let completedSections = 0;

    this.shipData.forEach((section) => {
      const params = {
        batch_id: this.batchId,
        question: section.sectionName,
        sample_image_urls: section.downloadImageLinks,
        min_similarity: 0.5,
        top_k: 1,
      };

      this.http
        .post(`${this.apiUrl}/query/`, params, {
          observe: 'response',
          responseType: 'blob',
        })
        .subscribe({
          next: (res) => {
            const headers = res.headers;
            const bestMatchScore = parseFloat(
              headers.get('x-best-match-score') || '0'
            );
            const queryTime = headers.get('x-query-time-ms');
            const resultCount = headers.get('x-result-count');
            const results = headers.get('x-results');
            
            console.log('Match Results:', {
              bestMatchScore,
              queryTime,
              resultCount,
              results
            });
            
            if (res.body) {
              section.matchedUrl = URL.createObjectURL(res.body);
              // Convert score to percentage and round to 2 decimal places
              section.matchPercentage = Math.round(bestMatchScore * 100 * 100) / 100;
            }
            
            completedSections++;
            if (completedSections === totalSections) {
              this.uploading = false;
              this.message.success('Image matching completed');
            }
          },
          error: (err) => {
            console.error('Match error:', err);
            this.message.error(
              `Matching failed for section: ${section.sectionName}`
            );
            completedSections++;
            if (completedSections === totalSections) {
              this.uploading = false;
            }
          },
        });
    });
  }

  removeFile(file: NzUploadFile): void {
    this.fileList = this.fileList.filter((item) => item !== file);
  }
}
