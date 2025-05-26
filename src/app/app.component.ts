// import {
//   ChangeDetectorRef,
//   Component,
//   ElementRef,
//   ViewChild,
// } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
// import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
// import { NzButtonModule } from 'ng-zorro-antd/button';
// import { NzGridModule } from 'ng-zorro-antd/grid';
// import { NzCardModule } from 'ng-zorro-antd/card';
// import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';
// import { NzProgressModule } from 'ng-zorro-antd/progress';
// import { NzSpinModule } from 'ng-zorro-antd/spin';
// import { NzIconModule } from 'ng-zorro-antd/icon';
// import { NzImageModule } from 'ng-zorro-antd/image';
// import { Observable, Subscription, interval, of, throwError } from 'rxjs';
// import {
//   catchError,
//   filter,
//   map,
//   switchMap,
//   takeWhile,
//   tap,
// } from 'rxjs/operators';
// import { shipData } from './ship.data';

// interface UploadStatus {
//   totalFiles: number;
//   processedFiles: number;
//   progress: number;
//   status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
//   currentBatch: number;
//   totalBatches: number;
// }

// interface BatchResponse {
//   batch_id: string;
//   [key: string]: any;
// }

// @Component({
//   selector: 'app-root',
//   standalone: true,
//   imports: [
//     CommonModule,
//     NzUploadModule,
//     NzButtonModule,
//     NzGridModule,
//     NzCardModule,
//     NzMessageModule,
//     NzProgressModule,
//     NzSpinModule,
//     NzIconModule,
//     NzImageModule,
//   ],
//   templateUrl: './app.component.html',
//   styleUrl: './app.component.scss',
// })
// export class AppComponent {
//   private apiUrl = 'https://netsumimage.meancloud.in';
//   private readonly BATCH_SIZE = 100;
//   fileList: NzUploadFile[] = [];
//   uploading = false;
//   selectLoading = false;
//   batchId: string | null = null;
//   uploadStatus: UploadStatus = {
//     totalFiles: 0,
//     processedFiles: 0,
//     progress: 0,
//     status: 'pending',
//     currentBatch: 0,
//     totalBatches: 0,
//   };

//   shipData = shipData.map((section) => ({
//     ...section,
//     matchPercentage: 0,
//   }));

//   @ViewChild('uploadInput') uploadInput!: ElementRef;
//   @ViewChild('uploadButton') uploadButton!: ElementRef;

//   constructor(
//     private http: HttpClient,
//     private message: NzMessageService,
//     private cdr: ChangeDetectorRef
//   ) {}

//   handleUpload(event: Event): void {
//     this.selectLoading = true;
//     this.cdr.detectChanges();

//     const input = event.target as HTMLInputElement;
//     const files = input.files;

//     if (!files) {
//       this.selectLoading = false;
//       this.cdr.detectChanges();
//       return;
//     }

//     setTimeout(() => {
//       const selectedFiles = Array.from(files);
//       const numberOfFiles = selectedFiles.length;
//       let processedCount = 0;

//       selectedFiles.forEach((file, index) => {
//         if (file.type?.startsWith('image/')) {
//           const nzFile: NzUploadFile = {
//             uid: `${Date.now()}-${this.fileList.length + index}`,
//             name: file.name,
//             size: file.size,
//             type: file.type,
//             originFileObj: file,
//           };
//           this.fileList = [...this.fileList, nzFile];
//         } else {
//           this.message.error(`"${file.name}" is not an image file`);
//         }

//         processedCount++;

//         if (processedCount === numberOfFiles) {
//           if (this.fileList.length > 1000) {
//             this.message.warning('Maximum 1000 images can be uploaded at once');
//             this.fileList = this.fileList.slice(0, 1000);
//           }

//           this.selectLoading = false;
//           this.cdr.detectChanges();
//         }
//       });
//     }, 0);
//   }

//   percentageOfUpload(): number {
//     if (this.uploadStatus && this.batchId) {
//       return Number(
//         (
//           (this.uploadStatus.currentBatch / this.uploadStatus.totalBatches) *
//           100
//         ).toFixed(0)
//       );
//     }
//     return 0;
//   }

//   private uploadBatch(
//     files: NzUploadFile[],
//     batchNumber: number,
//     totalBatches: number
//   ): Observable<any> {
//     const formData = new FormData();
//     files.forEach((file) => {
//       if (file.originFileObj) {
//         formData.append('files', file.originFileObj);
//       }
//     });

//     const batchInfo = {
//       uploadDate: new Date().toISOString(),
//       totalFiles: files.length,
//       name: `Ship Images Batch ${batchNumber + 1}/${totalBatches}`,
//       description: `Part ${batchNumber + 1} of ${totalBatches} total batches`,
//     };

//     formData.append(
//       'batch_info',
//       new Blob([JSON.stringify(batchInfo)], { type: 'application/json' })
//     );

//     const endpoint =
//       batchNumber === 0
//         ? `${this.apiUrl}/upload_images/`
//         : `${this.apiUrl}/append_to_batch/?batch_id=${this.batchId}`;

//     return this.http.post(endpoint, formData).pipe(
//       switchMap((res: any) => {
//         if (batchNumber === 0 && res?.batch_id) {
//           this.batchId = res.batch_id;
//         }

//         this.uploadStatus.processedFiles += files.length;
//         this.uploadStatus.currentBatch = batchNumber + 1;

//         return this.pollUntilCompleted(this.batchId!);
//       }),
//       catchError((error) => {
//         this.message.error(
//           `Batch ${batchNumber + 1} upload error: ${error.message}`
//         );
//         return of(null);
//       })
//     );
//   }

//   uploadFiles(): void {
//     if (this.fileList.length === 0) {
//       this.message.warning('Please select images to upload');
//       return;
//     }

//     this.uploading = true;
//     this.uploadStatus = {
//       totalFiles: this.fileList.length,
//       processedFiles: 0,
//       progress: 0,
//       status: 'uploading',
//       currentBatch: 0,
//       totalBatches: Math.ceil(this.fileList.length / this.BATCH_SIZE),
//     };

//     const batches: NzUploadFile[][] = [];
//     for (let i = 0; i < this.fileList.length; i += this.BATCH_SIZE) {
//       batches.push(this.fileList.slice(i, i + this.BATCH_SIZE));
//     }

//     const uploadSequentially = (index: number) => {
//       if (index >= batches.length) {
//         this.uploadStatus.status = 'completed';
//         this.uploading = false;
//         this.message.success('All batches uploaded successfully');
//         return;
//       }

//       this.uploadBatch(batches[index], index, batches.length).subscribe({
//         next: (response) => {
//           if (response) {
//             uploadSequentially(index + 1);
//           } else {
//             this.handleUploadError();
//           }
//         },
//         error: () => this.handleUploadError(),
//       });
//     };

//     uploadSequentially(0);
//   }

//   private pollUntilCompleted(batchId: string): Observable<any> {
//     return interval(1000).pipe(
//       switchMap(() =>
//         this.http.get<{ status: string }>(
//           `${this.apiUrl}/batch_status/${batchId}`
//         )
//       ),
//       takeWhile((res) => res.status !== 'completed', true),
//       filter((res) => res.status === 'completed'),
//       tap(() => {
//         // this.message.success(`Batch ${batchId} processing completed.`);
//       }),
//       catchError((err) => {
//         this.message.error('Error checking batch status');
//         return throwError(() => err);
//       })
//     );
//   }

//   private handleUploadError(): void {
//     this.uploading = false;
//     this.uploadStatus.status = 'error';
//   }

//   matchImages(): void {
//     if (!this.batchId) {
//       this.message.warning('Please upload images first');
//       return;
//     }

//     this.uploading = true;
//     const totalSections = this.shipData.length;
//     let completedSections = 0;

//     this.shipData.forEach((section) => {
//       const params = {
//         batch_id: this.batchId,
//         question: section.sectionName,
//         sample_image_urls: section.downloadImageLinks,
//         min_similarity: 0.5,
//         top_k: 3,
//       };

//       this.http.post(`${this.apiUrl}/query/`, params).subscribe({
//         next: (res: any) => {
//           if (res?.images?.results?.length) {
//             const updatedResults = res.images.results.map((img: any) => ({
//               ...img,
//               similarity_score: Math.round(img.similarity_score * 100),
//             }));

//             section.matchArr.push(...updatedResults);
//           }

//           completedSections++;
//           if (completedSections === totalSections) {
//             this.uploading = false;
//             this.message.success('Image matching completed');
//             this.deleteBatchId();
//           }
//         },
//         error: () => {
//           this.message.error(
//             `Matching failed for section: ${section.sectionName}`
//           );
//           completedSections++;
//           if (completedSections === totalSections) {
//             this.uploading = false;
//           }
//         },
//       });
//     });
//   }

//   removeFile(file: NzUploadFile): void {
//     this.fileList = this.fileList.filter((item) => item !== file);
//   }

//   ngOnDestroy(): void {
//     this.deleteBatchId();
//   }
//   deleteBatchId(): void {
//     const body = { batch_id: this.batchId };
//     this.http.delete(`${this.apiUrl}/delete_batch/`, { body }).subscribe({
//       next: () => {},
//       error: () => {},
//     });
//   }
// }


import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';
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
import { Observable, Subscription, interval, of, throwError, forkJoin } from 'rxjs';
import {
  catchError,
  filter,
  map,
  switchMap,
  takeWhile,
  tap,
  timeout,
  retry,
} from 'rxjs/operators';
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
  private readonly BATCH_SIZE = 50; // Reduced batch size for faster processing
  private readonly MAX_CONCURRENT_BATCHES = 3; // Parallel batch processing
  private readonly APPEND_TIMEOUT = 15000; // 15 second timeout for append operations
  private readonly MAX_RETRIES = 2; // Retry failed requests
  
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

  constructor(
    private http: HttpClient,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef
  ) {}

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
          // Compress image before adding to file list
          this.compressImage(file).then(compressedFile => {
            const nzFile: NzUploadFile = {
              uid: `${Date.now()}-${this.fileList.length + index}`,
              name: file.name,
              size: compressedFile.size,
              type: compressedFile.type,
              originFileObj: compressedFile,
            };
            this.fileList = [...this.fileList, nzFile];
            
            processedCount++;
            this.checkProcessingComplete(processedCount, numberOfFiles);
          });
        } else {
          this.message.error(`"${file.name}" is not an image file`);
          processedCount++;
          this.checkProcessingComplete(processedCount, numberOfFiles);
        }
      });
    }, 0);
  }

  private checkProcessingComplete(processedCount: number, totalFiles: number): void {
    if (processedCount === totalFiles) {
      if (this.fileList.length > 1000) {
        this.message.warning('Maximum 1000 images can be uploaded at once');
        this.fileList = this.fileList.slice(0, 1000);
      }

      this.selectLoading = false;
      this.cdr.detectChanges();
    }
  }

  // Image compression to reduce upload time
  private compressImage(file: File, quality: number = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1920x1080 for faster upload)
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original if compression fails
          }
        }, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  percentageOfUpload(): number {
    if (this.uploadStatus && this.batchId) {
      return Number(
        (
          (this.uploadStatus.currentBatch / this.uploadStatus.totalBatches) *
          100
        ).toFixed(0)
      );
    }
    return 0;
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

    const endpoint =
      batchNumber === 0
        ? `${this.apiUrl}/upload_images/`
        : `${this.apiUrl}/append_to_batch/?batch_id=${this.batchId}`;

    // Add timeout and retry logic specifically for append operations
    const httpRequest = this.http.post(endpoint, formData).pipe(
      timeout(batchNumber === 0 ? 30000 : this.APPEND_TIMEOUT), // Different timeout for append
      retry(this.MAX_RETRIES),
      switchMap((res: any) => {
        if (batchNumber === 0 && res?.batch_id) {
          this.batchId = res.batch_id;
        }

        this.uploadStatus.processedFiles += files.length;
        this.uploadStatus.currentBatch = batchNumber + 1;

        return this.pollUntilCompleted(this.batchId!);
      }),
      catchError((error) => {
        console.error(`Batch ${batchNumber + 1} upload error:`, error);
        this.message.error(
          `Batch ${batchNumber + 1} upload error: ${error.message || 'Request timeout'}`
        );
        return of(null);
      })
    );

    return httpRequest;
  }

  // Option 1: Sequential upload with optimizations (current approach but improved)
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
            // Add small delay to prevent overwhelming the server
            setTimeout(() => uploadSequentially(index + 1), 500);
          } else {
            this.handleUploadError();
          }
        },
        error: () => this.handleUploadError(),
      });
    };

    uploadSequentially(0);
  }

  // Option 2: Parallel upload for better performance (alternative approach)
  uploadFilesParallel(): void {
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

    // First batch (creates batch_id)
    this.uploadBatch(batches[0], 0, batches.length).subscribe({
      next: (response) => {
        if (response && this.batchId) {
          // Upload remaining batches in parallel (with limited concurrency)
          this.uploadRemainingBatchesParallel(batches.slice(1));
        } else {
          this.handleUploadError();
        }
      },
      error: () => this.handleUploadError(),
    });
  }

  private uploadRemainingBatchesParallel(batches: NzUploadFile[][]): void {
    if (batches.length === 0) {
      this.uploadStatus.status = 'completed';
      this.uploading = false;
      this.message.success('All batches uploaded successfully');
      return;
    }

    // Process batches in chunks to limit concurrent requests
    const processChunk = (startIndex: number) => {
      const endIndex = Math.min(startIndex + this.MAX_CONCURRENT_BATCHES, batches.length);
      const chunkBatches = batches.slice(startIndex, endIndex);
      
      const parallelUploads = chunkBatches.map((batch, index) => 
        this.uploadBatch(batch, startIndex + index + 1, batches.length + 1)
      );

      forkJoin(parallelUploads).subscribe({
        next: (responses) => {
          if (endIndex < batches.length) {
            // Process next chunk
            setTimeout(() => processChunk(endIndex), 1000); // 1 second delay between chunks
          } else {
            this.uploadStatus.status = 'completed';
            this.uploading = false;
            this.message.success('All batches uploaded successfully');
          }
        },
        error: () => this.handleUploadError(),
      });
    };

    processChunk(0);
  }

  private pollUntilCompleted(batchId: string): Observable<any> {
    return interval(2000).pipe( // Increased polling interval to reduce server load
      switchMap(() =>
        this.http.get<{ status: string }>(
          `${this.apiUrl}/batch_status/${batchId}`
        ).pipe(
          timeout(5000), // 5 second timeout for status checks
          retry(1)
        )
      ),
      takeWhile((res) => res.status !== 'completed', true),
      filter((res) => res.status === 'completed'),
      tap(() => {
        // Optional: Add success message per batch
        // this.message.success(`Batch ${batchId} processing completed.`);
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

      this.http.post(`${this.apiUrl}/query/`, params).pipe(
        timeout(30000), // 30 second timeout for matching
        retry(1)
      ).subscribe({
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
            this.deleteBatchId();
          }
        },
        error: (error) => {
          console.error(`Matching failed for section: ${section.sectionName}`, error);
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

  ngOnDestroy(): void {
    this.deleteBatchId();
  }

  deleteBatchId(): void {
    if (!this.batchId) return;
    
    const body = { batch_id: this.batchId };
    this.http.delete(`${this.apiUrl}/delete_batch/`, { body }).pipe(
      timeout(5000),
      catchError(() => of(null)) // Ignore delete errors
    ).subscribe();
  }
}