import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { interval, Subject, switchMap, takeUntil } from 'rxjs';
import { VisNetworkService, Data, DataSet, Node, Options, Edge } from 'ngx-vis';
import { timer } from 'rxjs';
import { finalize } from 'rxjs/operators';




@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {


  public visNetworkOptions!: Options

  messages = [
    'Fetching data...',
    'Processing results...',
    'Almost there...',
    'Loading, please wait...',
  ];

  currentMessage = '';


  blocks = [
    { title: 'Semantic Processing', letter: 'C', completed: false, progress: 0, error: false, failed: false },
    { title: 'Patterns Processing', letter: 'D', completed: false, progress: 0, error: false , failed: false },
    { title: 'Graph Processing', letter: 'E', completed: false, progress: 0, error: false , failed: false },
    { title: 'Assessment Processing', letter: 'F', completed: false, progress: 0, error: false , failed: false }
  ];
  
  
  timeoutRef: any;


  fileContent: string | ArrayBuffer | null = null;

  dagId: string = 'spark_cd_to_lpg';
  dagRunId: string = '';
  results = '';
  subscription: any;
  fileInputLabel: any
  jsonString = ''
  jobStarted: boolean = false;
  jsonData: any;
  visData_1: any;
  visData_2: any;

  readyToShow: boolean = false;
  visNetworks: any[] = [];
  loadingData: boolean = false;
  requestError: any = '';

  airflowUrl = 'http://172.16.131.117:8080';

  

 

  constructor(private http: HttpClient, private visNetworkService: VisNetworkService) {

    // this.visNetworkOptions = {
    //   interaction:{
    //     zoomView: true,
    //   },
    //   physics: true,
    //   layout: {
    //     randomSeed: undefined,
    //     improvedLayout:true,
    //     clusterThreshold: 150,
    //     hierarchical: {
    //       enabled:false,
    //       levelSeparation: 150,
    //       nodeSpacing: 100,
    //       treeSpacing: 200,
    //       blockShifting: true,
    //       edgeMinimization: true,
    //       parentCentralization: true,
    //       direction: 'UD',        // UD, DU, LR, RL
    //       sortMethod: 'hubsize',  // hubsize, directed
    //       shakeTowards: 'leaves'  // roots, leaves
    //     }
    //   }
      
    // }
 
  }

  public networkInitialized(visNetwork: any): void {

  
    console.log('Seed:', this.visNetworkService);
    

    this.visNetworkService.on(visNetwork.id, 'click');

  // open your console/dev tools to see the click params
  this.visNetworkService.click.subscribe((eventData: any[]) => {
    if (eventData[0] === visNetwork.id) {
      console.log(eventData);
    }
  });
}

  ngOnInit() {
    // just for testing
    this.loadJsonData();
  }

  loadJsonData() {
    this.http.get<any[]>('assets/jsons/tpch.json').subscribe((jsonDatas) => {
      jsonDatas.forEach((jsonData, index) => {
        const visData = this.convertJsonToVisData(jsonData);
        const nodes = visData.nodes;
        const edges = visData.edges;
        const name = jsonData.pattern;

        
  
        this.visNetworks.push({
          name: name,
          id: `visNetwork_${index + 1}`,
          data: { nodes: nodes, edges: edges },
          options: {
            nodes: {
              shape: 'circle',
              size: 30, // Adjust this value to change the size of the nodes
            },
            interaction:{
              zoomView: true,
            },
            physics: true,
            layout: {
              randomSeed: 1,
              improvedLayout: true,
              hierarchical: {
                  enabled: false,
                  levelSeparation: 150,
                  nodeSpacing: 110,
                  treeSpacing: 200,
                  blockShifting: false,
                  edgeMinimization: true,
                  parentCentralization: true,
                  direction: "LR",
                  sortMethod: "directed",
                  shakeTowards: "roots"
              }
          }
          }
        });
      });
      // testing only
      //this.readyToShow = true;
      //this.dagRunId = 'asdasd'
      //this.loadingData = true;

    });
  }

  public ngOnDestroy(): void {
    //this.visNetworkService.off(this.visNetwork, 'click');
  }

  private createAuthorizationHeader(): HttpHeaders {
    const username = 'airflow';
    const password = 'airflow';
    const encodedCredentials = btoa(`${username}:${password}`);
    const headers = new HttpHeaders().set('Authorization', `Basic ${encodedCredentials}`);
    return headers;
  }

  convertJsonToVisData(jsonData: any) {
    const nodesData = jsonData.nodes.map((node: any) => ({
      id: node.id,
      label: node.label,
      title: 'Title of Node 5' 
    }));

    const edgesData = jsonData.edges.map((edge: any) => ({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      label: edge.label,
      arrows: edge.arrow
    }));

    return {
      nodes: new DataSet(nodesData),
      edges: new DataSet(edgesData)
    };
  }

  handleRequestFailure() {
    const failedBlockIndex = this.blocks.findIndex((block) => block.progress > 0 && !block.completed);
    if (failedBlockIndex !== -1) {
      this.blocks[failedBlockIndex].failed = true;
      this.blocks[failedBlockIndex].error = true;
      // Reset the progress and stop the spinner for the failed block
      this.blocks[failedBlockIndex].progress = 0;
    }
  }
  

  async startJob(): Promise<void> {

    if (!this.fileContent) {
      return;
    }

    this.requestError = '';
    this.jobStarted = true;
    this.changeMessage();
    
    const apiUrl = `/api/v1/dags/${this.dagId}/dagRuns`;
    const headers = this.createAuthorizationHeader();

    const conf = {
      "conf": {
        "file_content": this.fileContent
      }
    };


  this.http.post(`${this.airflowUrl}${apiUrl}`, conf, { headers }).subscribe({
      next: (res: any) => {
        this.dagRunId = res.dag_run_id;
        console.log('Job started successfully:', res.dag_run_id);
        // trigger function on success
        this.getDagRun(this.dagId, res.dag_run_id);
      },
      error: (err: any) => {
        this.jobStarted = false;
        this.requestError = err;
        console.error('Error starting job', err);
      }
    });

  }

  changeMessage() {
    if (!this.jobStarted) {
      clearTimeout(this.timeoutRef);
      return;
    }
  
    this.currentMessage = this.messages[Math.floor(Math.random() * this.messages.length)];
    this.timeoutRef = setTimeout(() => {
      this.changeMessage();
    }, 2000); // Change the message every 3 seconds
  }

  getDagRun(dagId: string, dagRunId: string): void {
    const apiUrl = `/api/v1/dags/${dagId}/dagRuns/${dagRunId}`;

    const headers = this.createAuthorizationHeader();
    this.requestError = '';
    // Check every 5 seconds
    const checkInterval = 1000;
    const stopChecking$ = new Subject<void>();

    // block progress
    const startTime = Date.now();
    const updateProgress = () => {
      const elapsedTime = Date.now() - startTime;
      const totalBlocks = this.blocks.length;
     
      this.blocks.forEach((block, index) => {
        const blockDuration = elapsedTime / totalBlocks;
        block.progress = Math.min(blockDuration / (index + 1), 100);
      });
    };
    const progressInterval = setInterval(updateProgress, 100);
    //

    this.loadingData = true;
    interval(checkInterval)
      .pipe(
        takeUntil(stopChecking$), // Stop checking when the job is finished
        // Switch to the GET request for each interval tick
        switchMap(() => this.http.get(`${this.airflowUrl}${apiUrl}`, { headers }))
      ).pipe(
        finalize(() => {
          clearInterval(progressInterval);
          this.blocks.forEach((block) => {
            if (block.progress === 100) {
              block.error = true;
            }
          });
        })
      )
      .subscribe({
        next: (res: any) => {
          if (res.state === 'success') {
            // when dag is over
            this.readyToShow = true;
            this.loadJsonData();
            stopChecking$.next(); // Stop checking when the job is finished
            this.jobStarted = false;
          }
          else if (res.state === 'failed') { 
            stopChecking$.next(); // Stop checking when the job is finished
            this.loadingData = false;
            this.jobStarted = false;
            this.handleRequestFailure();
            
          } else {
            console.log('Job is not finished yet, current state:', res.state);
          }
        },
        error: (err: any) => {
          stopChecking$.next(); // Stop checking when the job is finished
          console.error('Error fetching DAG run details', err);
          this.loadingData = false;
          this.jobStarted = false;
          this.requestError = err;
          this.handleRequestFailure();
        }
      });
  }


  title = 'An Automated Patterns-based Model-to-Model Mapping and Transformation System for Labeled Property Graphs';
  selectedFile: File | null = null;

  onFileSelected(event: any): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.fileContent = reader.result;
    };
    reader.readAsText(file);

    if (event.target.files && event.target.files.length > 0) {
      this.fileInputLabel = event.target.files[0].name;
    } else {
      this.fileInputLabel = 'No file selected';
    }

  }

}