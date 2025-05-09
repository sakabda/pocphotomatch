import { ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzImageModule } from 'ng-zorro-antd/image';
import {
  Observable,
  Subscription,
  interval,
  of,
  throwError,
} from 'rxjs';
import { catchError, filter, map, switchMap, takeWhile, tap } from 'rxjs/operators';
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
    NzImageModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private apiUrl = 'https://netsumimage.meancloud.in';
  private readonly BATCH_SIZE = 100;
  fileList: NzUploadFile[] = [];
  uploading = false;
  selectLoading = false;
  batchId: string | null = null;
  uploadStatus: UploadStatus = {
    totalFiles: 0,
    processedFiles: 0,
    progress: 0,
    status: 'pending',
    currentBatch: 0,
    totalBatches: 0,
  };

  shipData = shipData.map((section) => ({
    ...section,
    matchPercentage: 0,
  }));

  @ViewChild('uploadInput') uploadInput!: ElementRef;
  @ViewChild('uploadButton') uploadButton!: ElementRef;

  constructor(private http: HttpClient, private message: NzMessageService, private cdr: ChangeDetectorRef) {}

  handleUpload(event: Event): void {
    this.selectLoading = true;
    this.cdr.detectChanges();

    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (!files) {
      this.selectLoading = false;
      this.cdr.detectChanges();
      return;
    }

    setTimeout(() => {
      const selectedFiles = Array.from(files);
      const numberOfFiles = selectedFiles.length;
      let processedCount = 0;

      selectedFiles.forEach((file, index) => {
        if (file.type?.startsWith('image/')) {
          const nzFile: NzUploadFile = {
            uid: `${Date.now()}-${this.fileList.length + index}`,
            name: file.name,
            size: file.size,
            type: file.type,
            originFileObj: file,
          };
          this.fileList = [...this.fileList, nzFile];
        } else {
          this.message.error(`"${file.name}" is not an image file`);
        }

        processedCount++;

        if (processedCount === numberOfFiles) {
          if (this.fileList.length > 1000) {
            this.message.warning('Maximum 1000 images can be uploaded at once');
            this.fileList = this.fileList.slice(0, 1000);
          }

          this.selectLoading = false;
          this.cdr.detectChanges();
        }
      });
    }, 0);
  }

  // private uploadBatch(
  //   files: NzUploadFile[],
  //   batchNumber: number,
  //   totalBatches: number
  // ): Observable<any> {
  //   const formData = new FormData();
  //   files.forEach((file) => {
  //     if (file.originFileObj) {
  //       formData.append('files', file.originFileObj);
  //     }
  //   });

  //   const batchInfo: any = {
  //     uploadDate: new Date().toISOString(),
  //     totalFiles: files.length,
  //     name: `Ship Images Batch ${batchNumber + 1}/${totalBatches}`,
  //     description: `Part ${batchNumber + 1} of ${totalBatches} total batches`,
  //   };

   

  //   formData.append(
  //     'batch_info',
  //     new Blob([JSON.stringify(batchInfo)], { type: 'application/json' })
  //   );
    

  //   const endpoint =
  //     batchNumber === 0
  //       ? `${this.apiUrl}/upload_images/`
  //       : `${this.apiUrl}/append_to_batch/?batch_id=${this.batchId}`;



       

  //   return this.http
  //     .post(endpoint, formData, {
  //       reportProgress: true,
  //       observe: 'events',
  //     })
  //     .pipe(
  //       map((event) => {
  //         if (event.type === HttpEventType.UploadProgress && event.total) {
  //           const batchProgress = Math.round((100 * event.loaded) / event.total);
  //           const overallProgress = Math.round((batchNumber * 100 + batchProgress) / totalBatches);
  //           this.uploadStatus.progress = overallProgress;
  //         } else if (event.type === HttpEventType.Response) {
  //           if (event.body) {
  //             const response = event.body as BatchResponse;
  //             if (!this.batchId && response.batch_id) {
  //               this.batchId = response.batch_id;
  //             }
  //             this.uploadStatus.processedFiles += files.length;
  //             this.uploadStatus.currentBatch = batchNumber + 1;
  //             return response;
  //           }
  //         }
  //         return null;
  //       }),
  //       catchError((error) => {
  //         this.message.error(`Batch ${batchNumber + 1} upload error: ${error.message}`);
  //         return of(null);
  //       })
  //     );
  // }

  

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

  formData.append('batch_info', new Blob([JSON.stringify(batchInfo)], { type: 'application/json' }));

  const endpoint =
    batchNumber === 0
      ? `${this.apiUrl}/upload_images/`
      : `${this.apiUrl}/append_to_batch/?batch_id=${this.batchId}`;

  return this.http.post(endpoint, formData).pipe(
    switchMap((res: any) => {
      if (batchNumber === 0 && res?.batch_id) {
        this.batchId = res.batch_id;
      }

      this.uploadStatus.processedFiles += files.length;
      this.uploadStatus.currentBatch = batchNumber + 1;

      // If this is the first batch, poll until completed
      if (batchNumber === 0) {
        return this.pollUntilCompleted(this.batchId!);
      }

      return of(res); // next batches don’t poll
    }),
    catchError((error) => {
      this.message.error(`Batch ${batchNumber + 1} upload error: ${error.message}`);
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

    const batches: NzUploadFile[][] = [];
    for (let i = 0; i < this.fileList.length; i += this.BATCH_SIZE) {
      batches.push(this.fileList.slice(i, i + this.BATCH_SIZE));
    }

    const uploadSequentially = (index: number) => {
      if (index >= batches.length) {
        this.uploadStatus.status = 'completed';
        this.uploading = false;
        this.message.success('All batches uploaded successfully');
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


private pollUntilCompleted(batchId: string): Observable<any> {
  return interval(3000).pipe(
    switchMap(() =>
      this.http.get<{ status: string }>(`${this.apiUrl}/batch_status/${batchId}`)
    ),
    takeWhile((res) => res.status !== 'completed', true), // keep polling until status is 'completed'
    filter((res) => res.status === 'completed'), // only emit when completed
    tap(() => {
      this.message.success(`Batch ${batchId} processing completed.`);
    }),
    catchError((err) => {
      this.message.error('Error checking batch status');
      return throwError(() => err);
    })
  );
}



  private handleUploadError(): void {
    this.uploading = false;
    this.uploadStatus.status = 'error';
    //this.message.error('Upload failed');
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
        top_k: 3,
      };

      this.http.post(`${this.apiUrl}/query/`, params).subscribe({
        next: (res: any) => {
          if (res?.images?.results?.length) {
            const updatedResults = res.images.results.map((img: any) => ({
              ...img,
              similarity_score: Math.round(img.similarity_score * 100),
            }));

            section.matchArr.push(...updatedResults);
          }

          completedSections++;
          if (completedSections === totalSections) {
            this.uploading = false;
            this.message.success('Image matching completed');
          }
        },
        error: () => {
          this.message.error(`Matching failed for section: ${section.sectionName}`);
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

  ngOnDestroy(): void {
    const params = {
      params: new HttpParams().set('batch_id', this.batchId || '')
    };
    this.http.get(`${this.apiUrl}/delete_batch/`, params).subscribe({
      next: () => {},
      error: () => {}
    });
  }
}
