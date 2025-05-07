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
  // private apiUrl = 'http://65.109.13.253:8000';
   private apiUrl = 'https://netsumimage.meancloud.in'
  private readonly BATCH_SIZE = 100; // Size of each upload batch
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
  pollingSubscription?: Subscription;

  shipData = shipData.map((section) => ({
    ...section,
    matchPercentage: 0,
  }));

   @ViewChild('uploadInput') uploadInput!: ElementRef;
  @ViewChild('uploadButton') uploadButton!: ElementRef;

  constructor(private http: HttpClient, private message: NzMessageService, private cdr: ChangeDetectorRef) {}




handleUpload(event: Event): void {
  this.selectLoading = true;
  this.cdr.detectChanges(); // trigger UI update

  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (!files) {
    this.selectLoading = false;
    this.cdr.detectChanges();
    return;
  }

  // Use setTimeout to let the loader render
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
        this.cdr.detectChanges(); // Final change detection
      }
    });
  }, 0);
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
          this.message.error(`Batch ${batchNumber + 1} upload error:`, error);
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
     this.message.error('Upload failed');
    this.uploading = false;
    this.uploadStatus.status = 'processing';
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
        top_k: 3,
      };

      this.http
        .post(`${this.apiUrl}/query/`, params)
      

         .subscribe({
          next: (res: any) => {
            console.log('response', res);
            

            // Ensure `results` exists and is an array
           
            if (res?.images?.results?.length) {
                const updatedResults = res.images.results.map((img: any) => ({
                ...img,
                similarity_score: Math.round(img.similarity_score * 100)
              }));

              section.matchArr.push(...updatedResults);
            }


            

            // section.matchedUrl =res?.image?.data
            // section.matchPercentage = Math.round(res?.best_match_score * 100 ) ;
           
            
            completedSections++;
            if (completedSections === totalSections) {
              this.uploading = false;
              this.message.success('Image matching completed');
            }
          },          
          error: (err) => {
            
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
    // remove images with batch
    const params = {
      params: new HttpParams().set('batch_id', this.batchId || '')
    };
    this.http.get(`${this.apiUrl}/delete_batch/`, params).subscribe({
      next: (response) => {
        
      },
      error: (error) => { 
        
      }
    });
  }}